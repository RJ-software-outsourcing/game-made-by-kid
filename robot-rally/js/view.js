import * as T from '../vendor/three.module.js'
import { frames } from './catalog.js'
import { BodyCards } from './body-cards.js'
import { createRobot } from './robot.js'
import { WorkshopCamera } from './workshop-camera.js'
import { createWorkshopFinish, createArenaFinish } from './workshop-finish.js'
import { workshopProbe } from './workshop-light.js'
import { assembleHall } from './hall.js'
import { ringsideLift } from './ringside.js'
import { groundContact, contactTexture, landedContact } from './ground-contact.js'
import { fallSupport } from './knockdown.js'
import { HeadLabels } from './head-labels.js'
import { framePortrait } from './model-outline.js'
import { ToolRange } from './tool-range.js'
import { WeaponEffects } from './weapon-fx.js'
import { createArena, createPodium } from './stages.js'
import { createFormShadow } from './form-shadow.js'
import { createAudience } from './audience.js'
import { createTrophy } from './trophy.js'
import { RenderQuality } from './render-quality.js'
import { PerformanceLog } from './performance.js'
import { createRingEffects } from './ring-fx.js'
import { createGuardPanels } from './guard-panel.js'
import { LensField, verticalLensAngle } from './lens-field.js'
import { TireMarks } from './tire-marks.js'
import { palmHeight, contactPoint, bodyImpactHeight } from './bumper-contact.js'
import { STEP } from './match.js'

export const cameras = ['Ringside', 'Chase', 'Overhead', 'Orbit', 'Bot cam']
function lightScene(env, shadowExtent = 0) {
  const s = new T.Scene()
  s.environment = env
  s.add(new T.HemisphereLight(0xfff5de, 0x748d8e, 1.08))
  const key = new T.DirectionalLight(0xffead4, 2.05)
  key.position.set(-3, 6, 4)
  s.add(key)
  if (shadowExtent) {
    key.castShadow = true
    key.shadow.mapSize.set(512, 512)
    Object.assign(key.shadow.camera, {
      left: -shadowExtent,
      right: shadowExtent,
      top: shadowExtent,
      bottom: -shadowExtent,
      near: 1,
      far: 15
    })
    key.shadow.bias = -0.0008
    key.shadow.normalBias = 0.018
    key.shadow.autoUpdate = false
    key.shadow.needsUpdate = true
    s.userData.key = key
  }
  const rim = new T.DirectionalLight(0xc4eae6, 1.25)
  rim.position.set(3, 4, -4)
  s.add(rim)
  return s
}
// Prefiltered once from the workshop softboxes. The packed cube faces already
// contain the roughness levels used by Three's standard material.
function reflectionMap(texture) {
  texture.colorSpace = T.SRGBColorSpace
  texture.mapping = T.CubeUVReflectionMapping
  texture.flipY = false
  texture.generateMipmaps = false
  texture.minFilter = T.LinearFilter
  return texture
}
export function studioLight(upgrade) {
  return new Promise((resolve) => {
    let usingFallback = false
    const useFallback = () => {
      if (usingFallback) return
      usingFallback = true
      resolve(softboxLight())
    }
    // A stalled reflection image must not keep a downloaded game on its
    // loading screen. The full studio lighting can arrive after the first draw.
    const timer = setTimeout(useFallback, 1200)
    new T.TextureLoader().load(
      './art/garage-light.webp',
      (texture) => {
        clearTimeout(timer)
        texture.userData.packedWorkshop = true
        if (!usingFallback) resolve(texture)
        else if (upgrade) upgrade(texture)
        else texture.dispose()
      },
      undefined,
      () => {
        clearTimeout(timer)
        useFallback()
      }
    )
  })
}
function unpackStudio(texture, renderer) {
  if (!texture.userData.packedWorkshop) return texture
  try {
    return workshopProbe(texture, renderer)
  } catch {
    texture.dispose()
    return softboxLight()
  }
}
function softboxLight() {
  const panel = document.createElement('canvas')
  panel.width = 256
  panel.height = 128
  const ctx = panel.getContext('2d')
  const sky = ctx.createLinearGradient(0, 0, 0, 128)
  for (const [height, color] of [
    [0, '#eef4f4'],
    [0.36, '#99b4bb'],
    [0.56, '#586d66'],
    [1, '#554735']
  ])
    sky.addColorStop(height, color)
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, 256, 128)
  ctx.fillStyle = '#fff4dc'
  ctx.fillRect(38, 21, 31, 32)
  ctx.fillRect(71, 21, 19, 32)
  ctx.fillStyle = '#e3ffff'
  ctx.fillRect(172, 34, 46, 12)
  const texture = new T.CanvasTexture(panel)
  texture.colorSpace = T.SRGBColorSpace
  texture.mapping = T.EquirectangularReflectionMapping
  return texture
}
export class View {
  constructor(onFrame, onLost, onReady, env) {
    const host = (this.host = document.querySelector('#render-host'))
    this.work = document.querySelector('#work-view')
    this.rival = document.querySelector('#inspect')
    this.work.prepend(host)
    try {
      this.renderer = new T.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance'
      })
    } catch {
      // A memory-constrained device may still have room for a single-sample
      // drawing buffer. Keep the same scenes and materials in that case.
      this.renderer = new T.WebGLRenderer({ alpha: true, antialias: false, powerPreference: 'default' })
    }
    const r = this.renderer
    r.outputColorSpace = T.SRGBColorSpace
    r.toneMapping = T.ACESFilmicToneMapping
    r.toneMappingExposure = 1
    r.shadowMap.enabled = true
    r.shadowMap.type = T.PCFSoftShadowMap
    r.autoClear = false
    r.setClearColor(0, 0)
    host.append(r.domElement)
    r.domElement.addEventListener('webglcontextlost', (e) => {
      e.preventDefault()
      this.lost = true
      onLost()
    })
    r.domElement.addEventListener('webglcontextrestored', () => {
      this.lost = false
      this.last = 0
      this.resizePending = true
      this.portraitDirty = true
      this.effectsWarm = false
      for (const scene of [this.shop, this.arena]) scene.userData.key.shadow.needsUpdate = true
      this.invalidate()
      onReady()
    })
    this.workshopFinish = createWorkshopFinish()
    this.arenaFinish = createArenaFinish()
    env = unpackStudio(env, r)
    this.env = env
    this.shop = lightScene(this.env, 2.1)
    this.scout = lightScene(this.env)
    this.arena = lightScene(this.env, 4.4)
    this.shop.add(createPodium().group)
    this.portraitCanvas = document.createElement('canvas')
    this.portraitCanvas.className = 'scout-portrait'
    this.portraitCanvas.setAttribute('aria-hidden', 'true')
    this.rival.append(this.portraitCanvas)
    this.portraitDirty = true
    this.shadowTimer = 0
    this.shopShadow = groundContact()
    this.shop.add(this.shopShadow)
    this.scoutCam = new T.PerspectiveCamera(29, 1, 0.05, 50)
    this.shopCam = new T.PerspectiveCamera(30, 1, 0.05, 50)
    this.arenaCam = new T.PerspectiveCamera(41, 1, 0.1, 70)
    this.focusPoint = new T.Vector3()
    this.shopTarget = new T.Vector3()
    this.focusAmount = 0
    this.focusMarker = document.createElement('span')
    this.focusMarker.className = 'part-locator'
    this.focusMarker.hidden = true
    this.focusMarker.setAttribute('aria-hidden', 'true')
    this.work.append(this.focusMarker)
    this.angle = -0.06
    this.spinRemaining = 0
    this.cam = 0
    this.mode = 'shop'
    this.adaptive = new RenderQuality()
    const motionPreference = matchMedia('(prefers-reduced-motion: reduce)')
    this.reduced = motionPreference.matches
    motionPreference.addEventListener('change', ({ matches }) => {
      this.reduced = matches
      if (matches) {
        this.angle += this.spinRemaining * (this.spinDirection || 1)
        this.spinRemaining = 0
        this.cameraSnap = true
        this.fx.clear()
      }
      if (this.mode === 'shop') this.wakeShop()
      else this.invalidate()
    })
    this.shadows = [groundContact(), groundContact()]
    this.arena.add(...this.shadows)
    this.fx = createRingEffects(this.arena)
    this.target = new T.Vector3()
    this.nextCamera = new T.Vector3()
    this.nextTarget = new T.Vector3()
    this.metrics = { fps: 0, draws: 0, triangles: 0, pixelRatio: 1 }
    r.info.autoReset = false
    this.bodyCards = new BodyCards()
    this.pickRay = new T.Raycaster()
    this.pickPoint = new T.Vector2()
    this.assembly = 0
    this.resizePending = true
    this.workshopCamera = new WorkshopCamera(this.work, document.getElementById('close-look'), this)
    this.bindArenaGestures()
    this.onScreen = true
    this.frozen = false
    this.shopActivity = performance.now()
    const wakeShop = () => this.wakeShop()
    this.work.closest('main').addEventListener('pointerdown', wakeShop, { passive: true })
    this.work.closest('main').addEventListener('keydown', wakeShop)
    this.performanceLog = new URLSearchParams(location.search).has('perf') ? new PerformanceLog() : null
    this.visibilityObserver = new IntersectionObserver(([entry]) => {
      this.onScreen = entry.isIntersecting
      if (this.mode === 'shop' && this.onScreen) {
        this.last = 0
        this.wakeShop()
      }
    })
    this.visibilityObserver.observe(this.work)
    this.observer = new ResizeObserver(() => {
      this.resizePending = true
      this.invalidate()
    })
    this.observer.observe(document.querySelector('.overview'))
    this.observer.observe(this.rival)
    window.addEventListener('resize', () => {
      this.resizePending = true
      this.invalidate()
    })
    this.onFrame = onFrame
    this.running = false
    this.last = 0
    this.invalidate()
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.shopActivity = performance.now()
        this.last = 0
        this.invalidate()
      } else {
        clearTimeout(this.idleTimer)
        cancelAnimationFrame(this.raf)
        this.running = false
      }
    })
  }
  wakeShop() {
    const now = performance.now()
    if (this.mode === 'shop' && !this.running && now - this.last > 500) this.last = 0
    this.shopActivity = now
    if (this.mode === 'shop') this.invalidate()
  }
  invalidate() {
    clearTimeout(this.idleTimer)
    if (!this.running && !document.hidden) {
      this.running = true
      this.raf = requestAnimationFrame((t) => this.frame(t))
    }
  }
  bindArenaGestures() {
    const arena = document.querySelector('#battle'),
      touches = new Map()
    let pinchSize = 0
    this.clearTouches = () => {
      touches.clear()
      this.holdingArena = false
      pinchSize = 0
    }
    const separation = () => {
      const [a, b] = touches.values()
      return Math.hypot(a.x - b.x, a.y - b.y)
    }
    arena.addEventListener('pointerdown', (e) => {
      if (this.frozen || this.lockCamera || touches.size >= 2 || e.target.closest('button,dialog')) return
      this.openingTime = 0
      this.holdingArena = true
      touches.set(e.pointerId, {
        x: e.clientX,
        y: e.clientY,
        startX: e.clientX,
        startY: e.clientY,
        drag: false
      })
      arena.setPointerCapture(e.pointerId)
      if (touches.size === 2) pinchSize = separation()
    })
    arena.addEventListener('pointermove', (e) => {
      const p = touches.get(e.pointerId)
      if (!p || this.frozen) return
      const dx = e.clientX - p.x,
        dy = e.clientY - p.y
      p.x = e.clientX
      p.y = e.clientY
      if (!p.drag && touches.size === 1 && Math.hypot(p.x - p.startX, p.y - p.startY) < 5) return
      p.drag = true
      if (this.cam !== 3) {
        if (this.cam === 4) this.cameraSnap = true
        this.syncOrbit()
        this.cam = 3
        this.onCameraChange?.(cameras[3])
      }
      if (touches.size === 2) {
        const size = separation()
        if (size > 5 && pinchSize > 5)
          this.zoom = T.MathUtils.clamp((this.zoom * pinchSize) / size, 0.72, 1.8)
        pinchSize = size
      } else if (touches.size === 1) {
        this.orbitYaw -= dx * 0.009
        this.orbitPitch = T.MathUtils.clamp(this.orbitPitch + dy * 0.005, 0.12, 1.25)
      }
      if (this.replayPaused) {
        this.cameraSnap = true
        this.invalidate()
      }
    })
    const release = (e) => {
      if (!touches.delete(e.pointerId)) return
      this.holdingArena = touches.size > 0
      this.orbitReleasedAt = performance.now()
      pinchSize = 0
    }
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture'])
      arena.addEventListener(event, release)
  }
  freeze(value) {
    this.frozen = value
    if (value) this.clearTouches()
    if (!value) {
      this.shopActivity = performance.now()
      this.last = 0
      this.invalidate()
    }
  }
  pickAt(x, y) {
    if (this.mode !== 'shop' || this.frozen || !this.player) return
    this.pickRay.setFromCamera(this.pickPoint.set(x * 2 - 1, 1 - y * 2), this.shopCam)
    const id = this.player.pickPart(this.pickRay)
    if (id) this.onPartSelect?.(id)
  }
  previewPart(slot) {
    if (this.previewSlot === slot) return
    this.previewSlot = slot
    this.workshopCamera.reset()
    if (!slot) this.focusMarker.hidden = true
    this.wakeShop()
  }
  frameWorkbench(dt, now, spread) {
    const active = this.previewSlot
    const target = active ? 1 : 0
    this.focusAmount = this.reduced ? target : T.MathUtils.damp(this.focusAmount, target, 8, dt)
    if (Math.abs(this.focusAmount - target) < 0.001) this.focusAmount = target
    const blend = this.focusAmount
    const height = this.garageEyeHeight ?? 0.86
    this.shopTarget.set(0, height + spread * 0.27, 0)
    if (active) {
      this.player.getPartPosition(this.previewSlot, this.focusPoint)
      this.player.group.localToWorld(this.focusPoint)
    }
    if (blend > 0) this.shopTarget.lerp(this.focusPoint, blend * 0.4)
    const dolly = (1 - 0.07 * blend) * Math.max(1, 0.99 / this.shopCam.aspect)
    const lift = this.previewSlot === 'brain' ? 1.5 : this.previewSlot === 'motor' ? -0.35 : 0
    this.shopCam.position
      .set(
        (2.5 + spread * 0.69) * dolly,
        (1.01 + lift * blend + spread * 0.53) * dolly,
        (4.53 + spread * 1.37) * dolly
      )
      .add(this.shopTarget)
    this.shopCam.lookAt(this.shopTarget)
    this.workshopCamera.apply(this.shopCam, this.width, this.height)
    if (active && now < this.markerUntil) {
      this.shopCam.updateMatrixWorld()
      this.markerPoint ??= new T.Vector3()
      this.markerPoint.copy(this.focusPoint).project(this.shopCam)
      const x = (this.markerPoint.x + 1) * 0.5 * this.width,
        y = (1 - this.markerPoint.y) * 0.5 * this.height
      this.focusMarker.hidden = x < 16 || y < 16 || x > this.width - 16 || y > this.height - 16
      this.focusMarker.style.transform =
        'translate(' + Math.round(x - 18) + 'px,' + Math.round(y - 18) + 'px)'
      this.focusMarker.style.opacity = String(Math.min(1, (this.markerUntil - now) / 300))
    } else this.focusMarker.hidden = true
  }
  facePart(slot) {
    this.assembly = 1
    this.installedSlot = slot
    this.markerUntil = performance.now() + (this.reduced ? 0 : 1650)
    const angles = {
      brain: -0.19,
      cpu: -0.19,
      logic: -1.58,
      motor: -0.72,
      cell: 3.56,
      shell: -0.34,
      lens: 0.49,
      weapon: -0.33
    }
    const delta = Math.atan2(Math.sin(angles[slot] - this.angle), Math.cos(angles[slot] - this.angle))
    this.spinDirection = Math.sign(delta) || 1
    if (this.reduced) {
      this.angle += delta
      this.spinRemaining = 0
    } else this.spinRemaining = Math.abs(delta)
    this.invalidate()
  }
  spin() {
    this.spinDirection = 1
    if (this.reduced) {
      this.angle += 0.8
      this.spinRemaining = 0
    } else this.spinRemaining = Math.PI * 0.65
    this.invalidate()
  }
  setStudioLight(texture) {
    if (this.mode === 'arena') {
      this.pendingLight = texture
      return
    }
    const previous = this.env
    texture = unpackStudio(texture, this.renderer)
    this.env = texture
    for (const scene of [this.shop, this.scout]) scene.environment = texture
    this.arena.environment = this.hallLight || texture
    previous.dispose()
    this.bodyCards.lightingChanged()
    this.portraitDirty = this.resizePending = true
    this.invalidate()
  }
  setPaint(color) {
    this.paintColor = color
    this.player?.setPaint(color)
    this.wakeShop()
  }
  setRobots(build, round, champion = this.champion) {
    this.shopActivity = performance.now()
    this.champion = champion
    this.garageEyeHeight = frames[build.chassis ?? 0].center
    if (champion && !this.trophy) {
      this.trophy = createTrophy()
      this.trophy.group.scale.setScalar(0.8)
      this.trophy.group.position.set(0.99, 0, 0.26)
      this.trophy.group.rotation.y = -0.1
      this.shop.add(this.trophy.group)
    }
    if (this.trophy) this.trophy.group.visible = champion
    this.shop.userData.key.shadow.needsUpdate = true
    this.shopShadow.material.map = this.shadows[0].material.map = contactTexture(build)
    this.shadows[1].material.map = contactTexture(round.build)
    const playerKey = JSON.stringify(build)
    if (this.playerKey !== playerKey) {
      if (this.player) this.player.setBuild(build)
      else this.player = createRobot(build, this.paintColor)
      this.playerKey = playerKey
    }
    if (this.round !== round) {
      this.enemy?.dispose()
      this.enemy = createRobot(round.build, round.color)
      this.round = round
      this.portraitDirty = true
      this.resizePending = true
    }
    this.player.setFinishMaterial(this.quality >= 0.85 ? this.workshopFinish : this.arenaFinish)
    this.enemy.setFinishMaterial(this.workshopFinish)
    this.shop.add(this.player.group)
    this.scout.add(this.enemy.group)
    this.player.group.rotation.x = this.enemy.group.rotation.x = 0
    this.player.group.position.set(0, 0, 0)
    this.enemy.group.position.set(0, 0, 0)
    this.enemy.group.rotation.y = -0.32
    this.invalidate()
  }
  *assembleArena() {
    this.floor = createArena()
    yield
    this.audience = createAudience()
    this.guardPanels = createGuardPanels()
    this.scuffs = new TireMarks()
    this.arena.add(this.floor.group, this.audience.group, this.guardPanels.mesh, this.scuffs.mesh)
    this.arena.background = new T.Color('#344a43')
    yield
    this.hall = yield* assembleHall()
    this.arena.add(this.hall.group)
    new T.TextureLoader().load(
      './art/hall-light.webp',
      (texture) => {
        this.hallLight = reflectionMap(texture)
        this.arena.environment = this.hallLight
        this.invalidate()
      },
      undefined,
      () => {}
    )
    this.weaponEffects = new WeaponEffects(this.arena)
    yield
    if (this.renderer.extensions.has('KHR_parallel_shader_compile')) {
      this.renderer.compileAsync(this.arena, this.arenaCam).catch(() => {})
      this.floor.setLeanDeck(true)
      try {
        this.renderer.compileAsync(this.arena, this.arenaCam).catch(() => {})
      } finally {
        this.floor.setLeanDeck(false)
      }
    }
  }
  prepareArena(immediate = true) {
    if (this.arenaReady || this.lost) return
    this.construction ??= this.assembleArena()
    const started = performance.now()
    do {
      if (this.construction.next().done) {
        this.arenaReady = true
        this.construction = null
        return
      }
    } while (immediate || performance.now() - started < 4)
  }
  warmArena() {
    if (this.warmupScheduled || this.arenaReady || this.lost) return
    this.warmupScheduled = true
    const build = () => {
      this.warmupScheduled = false
      if (document.hidden || this.mode !== 'shop' || this.lost) return
      this.prepareArena(false)
      this.warmArena()
    }
    // Leave a paint and an input opportunity between batches. Entering the
    // ring finishes the same construction if the child taps Start immediately.
    if (window.requestIdleCallback) requestIdleCallback(build, { timeout: 250 })
    else setTimeout(build, this.construction ? 22 : 180)
  }
  warmContact() {
    // Exercise the actual screen pipeline during the introductory countdown.
    // Some mobile drivers link a pipeline on first draw even after shader compilation.
    const r = this.renderer
    this.fx.spawn(0, 0, true, 0)
    this.fx.update(0.045, this.arenaCam)
    this.arenaCam.position.set(0, 2, 6)
    this.arenaCam.lookAt(0, 1, 0)
    r.setScissor(0, 0, 1, 1)
    r.setScissorTest(true)
    r.render(this.arena, this.arenaCam)
    r.setScissorTest(false)
    this.fx.clear()
    this.effectsWarm = true
  }
  enter(match) {
    this.openingTime = 0
    this.performanceLog?.reset()
    document.querySelector('#battle').prepend(this.host)
    this.workshopCamera.reset()
    this.mode = 'arena'
    this.clearTouches()
    this.frozen = false
    this.victoryTime = 0
    this.fallFloor = null
    this.landed = false
    this.shadows.forEach((shadow, i) => {
      shadow.material.map = contactTexture(match.robots[i].build)
    })
    this.cheer = 0
    this.blend = 1
    this.replaySpeed = 1
    this.replayPaused = false
    this.orbitYaw = 0.36
    this.orbitPitch = 0.32
    this.zoom = 1
    this.match = match
    this.ringsideLift = 0
    this.ringsideYaw = 0.37
    this.orbitReleasedAt = performance.now()
    this.headLabels ??= new HeadLabels(document.getElementById('float-hud'))
    this.labelModels = [this.player, this.enemy]
    this.headLabels.reset(match, this.round.rival, this.labelModels)
    this.spinRemaining = 0
    this.cam = 0
    this.onboardSide = 0
    this.outsideCam = 0
    this.showRoutes = false
    this.lensTrial = false
    if (this.lensField) this.lensField.mesh.visible = false
    this.weaponTrial = false
    if (this.toolRange) this.toolRange.mesh.visible = false
    this.cameraSnap = true
    this.prepareArena()
    this.hall.resetShow()
    this.scuffs.clear()
    this.weaponEffects.clear()
    this.player.setFinishMaterial(this.arenaFinish, this.arenaFinish)
    this.enemy.setFinishMaterial(this.arenaFinish, this.arenaFinish)
    this.arena.add(this.player.group, this.enemy.group)
    this.fx.clear()
    this.resizePending = true
    this.adaptive.reset()
    this.invalidate()
  }
  showLensTrial() {
    this.lensTrial = true
    if (!this.lensField) {
      this.lensField = new LensField()
      this.arena.add(this.lensField.mesh)
    }
  }
  showWeaponTrial(fighter) {
    this.weaponTrial = true
    if (!this.toolRange) {
      this.toolRange = new ToolRange()
      this.arena.add(this.toolRange.mesh)
    }
    this.toolRange.fit(fighter)
  }
  releaseArenaModels() {
    this.player?.releaseArenaSkin()
    this.enemy?.releaseArenaSkin()
    this.reducedMeshes = false
    if (this.shadowModels) {
      for (const { proxy, casters } of this.shadowModels) {
        for (const mesh of casters) mesh.castShadow = true
        proxy.dispose()
      }
      this.shadowModels = null
    }
    this.leanShadows = false
  }
  exit(build, round, champion) {
    this.replayPaused = false
    this.releaseArenaModels()
    this.work.prepend(this.host)
    this.mode = 'shop'
    if (this.pendingLight) {
      this.setStudioLight(this.pendingLight)
      this.pendingLight = null
    }
    this.frozen = false
    this.match = null
    this.resizePending = true
    this.last = 0
    this.setRobots(build, round, champion)
  }
  framingDistance(separation) {
    return Math.max(4.55 + separation * 0.68, this.fitArenaWidth(separation + 1.68))
  }
  fitArenaWidth(span) {
    return span / (2 * Math.tan(T.MathUtils.degToRad(41 / 2)) * this.arenaCam.aspect * 0.82)
  }
  syncOrbit() {
    this.orbitReleasedAt = performance.now()
    const [a, b] = this.match.robots
    const pos = this.arenaCam.position
    const dx = pos.x - (a.x + b.x) / 2,
      dz = pos.z - (a.z + b.z) / 2,
      dy = pos.y - 0.9
    const flat = Math.hypot(dx, dz)
    this.orbitYaw = Math.atan2(dx, dz)
    this.orbitPitch = T.MathUtils.clamp(Math.atan2(dy, flat), 0.12, 1.25)
    const base = this.framingDistance(Math.hypot(a.x - b.x, a.z - b.z))
    this.zoom = T.MathUtils.clamp(Math.hypot(flat, dy) / base, 0.72, 1.8)
  }
  camera() {
    this.openingTime = 0
    const onboard = this.cam === 4
    if (this.cam === 2) this.syncOrbit()
    if (this.cam !== 4) this.outsideCam = this.cam
    this.onboardSide = 0
    this.cam = (this.cam + 1) % cameras.length
    this.cameraSnap = this.reduced || this.replayPaused || onboard || this.cam === 4
    this.invalidate()
    return cameras[this.cam]
  }
  teamCamera(side) {
    this.openingTime = 0
    if (this.cam === 4 && this.onboardSide === side) this.cam = this.outsideCam
    else {
      if (this.cam !== 4) this.outsideCam = this.cam
      this.cam = 4
      this.onboardSide = side
    }
    this.cameraSnap = true
    this.invalidate()
    return cameras[this.cam]
  }
  event(e) {
    if (e.kind === 'wave') this.weaponEffects.wave(e, this.match.time)
    if (e.flight) this.weaponEffects.arrive(e, this.match.time, !this.reduced)
    if (e.kind !== 'hit' && e.kind !== 'guard') return
    if (this.reduced) return
    if (e.flanking || e.reply > 0 || e.damage >= 15) this.hall.impactRails(this.match.time)
    this.cheer = e.kind === 'guard' || e.flanking ? 1 : 0.52
    if (e.kind === 'guard' || e.weapon < 2 || e.weapon === undefined)
      this.fx.spawn(
        e.x,
        e.z,
        e.kind === 'guard',
        e.heading,
        T.MathUtils.clamp((e.damage ?? 12) / 14, 0.56, 1.5),
        e.y
      )
  }
  panFor(fighter) {
    if (this.cam === 4 && fighter === this.match?.robots[this.onboardSide]) return 0
    this.soundPoint ??= new T.Vector3()
    this.soundPoint.set(fighter.x, palmHeight, fighter.z).applyMatrix4(this.arenaCam.matrixWorldInverse)
    const { x, z } = this.soundPoint
    // Perspective projection reverses off-screen sounds behind the lens.
    // Stereo follows the actual side of the camera, including at arm's length.
    return T.MathUtils.clamp((1.35 * x) / Math.max(0.65, Math.hypot(x, z)), -0.9, 0.9)
  }
  gainFor(point) {
    const camera = this.arenaCam.position
    const distance = Math.hypot(camera.x - point.x, camera.y - palmHeight, camera.z - point.z)
    // Mild attenuation keeps distant pushes intelligible above the spectators.
    return T.MathUtils.clamp(1 / (0.7 + 0.065 * distance), 0.55, 1.18)
  }
  get quality() {
    return this.adaptive.scale
  }
  bufferSize(w, h, ratio) {
    if (this.bufferWidth === w && this.bufferHeight === h && this.bufferRatio === ratio) return
    this.renderer.setDrawingBufferSize(w, h, ratio)
    this.bufferWidth = w
    this.bufferHeight = h
    this.bufferRatio = ratio
  }
  snapshotScout(camera, canvas) {
    // Reuse a corner of the current drawing buffer. Resizing the whole Retina
    // buffer twice per card reallocates its multisampled color and depth.
    const r = this.renderer,
      source = r.domElement
    const scale = Math.min(1, source.width / canvas.width, source.height / canvas.height)
    const w = Math.max(1, Math.floor(canvas.width * scale))
    const h = Math.max(1, Math.floor(canvas.height * scale))
    const vw = w / this.bufferRatio,
      vh = h / this.bufferRatio
    r.setViewport(0, 0, vw, vh)
    r.setScissor(0, 0, vw, vh)
    r.setScissorTest(true)
    try {
      r.clear()
      r.render(this.scout, camera)
      const ctx = canvas.getContext('2d')
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(source, 0, source.height - h, w, h, 0, 0, canvas.width, canvas.height)
    } finally {
      r.setScissorTest(false)
      r.setViewport(0, 0, this.bufferWidth, this.bufferHeight)
      r.clear()
    }
  }
  layout() {
    this.resizePending = false
    const arena = this.mode === 'arena',
      box = document.querySelector(arena ? '#battle' : '#work-view').getBoundingClientRect()
    const w = Math.max(1, Math.round(box.width)),
      h = Math.max(1, Math.round(box.height))
    this.host.style.left = '0px'
    this.host.style.top = '0px'
    this.host.style.width = w + 'px'
    this.host.style.height = h + 'px'
    // Cap total fill work, including on Retina and Stage Manager's wide windows.
    const d =
      Math.min(devicePixelRatio || 1, arena ? 1.6 : 1.75, Math.sqrt(1800000 / (w * h))) *
      (arena ? this.quality : Math.max(0.85, this.quality))
    this.bufferSize(w, h, d)
    this.metrics.pixelRatio = d
    this.width = w
    this.height = h
    if (arena) {
      this.arenaCam.aspect = w / h
      this.arenaCam.updateProjectionMatrix()
      return
    }
    this.shopCam.aspect = w / h
    this.shopCam.position.set(2.5, 1.87, 4.53)
    this.shopCam.lookAt(0, 0.86, 0)
    this.shopCam.updateProjectionMatrix()
    const portrait = this.rival.getBoundingClientRect(),
      pw = Math.max(1, Math.ceil(portrait.width * 1.5)),
      ph = Math.max(1, Math.ceil(portrait.height * 1.5))
    if (
      portrait.width > 0 &&
      portrait.height > 0 &&
      (this.portraitDirty || pw !== this.portraitCanvas.width || ph !== this.portraitCanvas.height)
    ) {
      // Snapshot the scout once per opponent or resize. The workshop animates in its own smaller buffer.
      this.portraitCanvas.width = pw
      this.portraitCanvas.height = ph
      this.scoutCam.aspect = pw / ph
      this.scoutCam.position.set(0.8, 1.58, 4.32)
      this.scoutCam.lookAt(0, 1, 0)
      this.scoutCam.clearViewOffset()
      this.scoutCam.updateProjectionMatrix()
      this.enemy.update({ time: 1.2 })
      framePortrait(this.enemy, this.scoutCam, pw, ph)
      this.snapshotScout(this.scoutCam, this.portraitCanvas)
      this.portraitDirty = false
    }
  }
  frame(now) {
    this.running = false
    if (document.hidden || this.lost || (!this.resizePending && this.mode === 'shop' && !this.onScreen))
      return
    // Once the child starts reading, an unattended turntable needs few frames.
    // A touch or keyboard action wakes it immediately, before the next display refresh.
    const idle = this.mode === 'shop' && !this.spinRemaining ? now - this.shopActivity : 0
    const staticScene =
      this.frozen ||
      this.replayPaused ||
      (this.mode === 'shop' && this.reduced && !this.spinRemaining) ||
      idle > 35000
    const interval =
      this.mode === 'arena' ? 1000 / 60 : this.reduced && !this.spinRemaining ? 1000 / 10 : 1000 / 30
    const draw = staticScene || this.resizePending || !this.last || now + 0.8 >= this.nextFrameAt
    if (draw) {
      const next = (this.nextFrameAt || now) + interval
      this.nextFrameAt = next > now + 0.8 && next < now + interval * 1.6 ? next : now + interval
    }
    if (!staticScene) {
      // A 30 Hz turntable does not need a callback at every 60/120 Hz
      // display refresh. Wake just ahead of its next frame. Input and resize
      // can still cancel this timer and request an immediate redraw.
      const wait = idle > 8500 ? 76 : this.mode === 'arena' ? 0 : this.nextFrameAt - performance.now() - 7
      if (wait > 4) this.idleTimer = setTimeout(() => this.invalidate(), wait)
      else this.invalidate()
    }
    if (!draw) return
    const raw = this.last ? (now - this.last) / 1000 : 0
    this.last = now
    const dt = Math.min(0.15, raw)
    if (this.resizePending) this.layout()
    this.onFrame(dt)
    if (!this.player) return
    const r = this.renderer
    r.info.reset()
    r.setScissorTest(false)
    r.setViewport(0, 0, this.width, this.height)
    r.clear()
    if (this.mode === 'arena') {
      if (this.resizePending) this.layout()
      if (!this.effectsWarm && !this.reduced) this.warmContact()
      this.drawArena(dt)
      if (raw > 0) this.metrics.fps = this.metrics.fps ? this.metrics.fps * 0.94 + 0.06 / raw : 1 / raw
      if (
        !this.frozen &&
        this.match.time > 0 &&
        this.match.winner === null &&
        this.replaySpeed === 1 &&
        this.adaptive.sample(raw)
      )
        this.resizePending = true
    } else {
      if (this.resizePending) this.layout()
      const advance = Math.min(this.spinRemaining, dt * 2.6)
      this.angle += advance * (this.spinDirection || 1)
      this.spinRemaining -= advance
      this.shopShadow.rotation.y = this.angle
      this.player.group.rotation.y = this.angle
      const t = this.reduced ? 0 : now / 1000
      this.assembly = this.reduced ? 0 : Math.max(0, this.assembly - dt * 2.4)
      if (this.trophy) this.trophy.group.visible = this.champion
      this.player.update({
        time: t,
        win: this.champion ? 0.65 : 0,
        assemble: this.assembly,
        slot: this.installedSlot
      })
      if (this.assembly > 0.6) this.shop.userData.key.shadow.needsUpdate = true
      this.frameWorkbench(dt, now, 0)
      if (this.spinRemaining > 0 || Math.abs((this.lastShadowAngle ?? 5) - this.angle) > 0.06) {
        this.shop.userData.key.shadow.needsUpdate = true
        this.lastShadowAngle = this.angle
      }
      this.bodyCards.renderNext(this)
      r.render(this.shop, this.shopCam)
      this.warmArena()
    }
    this.metrics.draws = r.info.render.calls
    this.metrics.triangles = r.info.render.triangles
    const live =
      this.mode === 'arena' &&
      this.replaySpeed === 1 &&
      this.match.time > 0 &&
      this.match.winner === null &&
      !this.frozen
    this.performanceLog?.record(now, raw, this.metrics, live)
  }
  shadowDetail(lean) {
    if (Boolean(this.leanShadows) === lean) return
    if (!this.shadowModels) {
      this.shadowModels = [this.player, this.enemy].map((robot) => {
        const casters = []
        robot.group.traverse((mesh) => {
          if (mesh.isMesh && mesh.castShadow) casters.push(mesh)
        })
        const proxy = createFormShadow(robot)
        this.arena.add(proxy.group)
        return { proxy, casters }
      })
    }
    for (const { proxy, casters } of this.shadowModels) {
      for (const mesh of casters) mesh.castShadow = !lean
      proxy.group.visible = lean
    }
    this.leanShadows = lean
    this.arena.userData.key.shadow.needsUpdate = true
  }
  drawArena(dt) {
    const m = this.match,
      [a, b] = m.robots
    if (m.winner !== null && !this.replayPaused) this.victoryTime += dt
    this.hall.updateShow(m.time, m.winner === 0 ? this.victoryTime : -1, this.reduced, this.quality < 0.75)
    if (m.winner !== null && this.victoryTime <= dt && this.cam === 4 && !this.replayPaused) {
      this.cam = 0
      this.cameraSnap = true
      this.onCameraChange?.(cameras[0])
    }
    const alpha = m.winner === null ? this.blend : 1
    const time = Math.max(0, m.time - (1 - alpha) * STEP) + this.victoryTime
    const celebrate = m.winner === null ? 0 : T.MathUtils.smoothstep(this.victoryTime, 0.18, 0.68)
    // The landing frame stamps the floor shadow. The next two frames sample
    // the fighters' new outlines for their overhead displays.
    const floorReady = this.landed
    this.palmTarget ??= new T.Vector3()
    this.toolAim ??= new T.Vector3()
    let followHeading = a.heading
    for (const [i, p, model] of [
      [0, a, this.player],
      [1, b, this.enemy]
    ]) {
      const x = T.MathUtils.lerp(p.prevX, p.x, alpha),
        z = T.MathUtils.lerp(p.prevZ, p.z, alpha)
      const turn = Math.atan2(Math.sin(p.heading - p.prevHeading), Math.cos(p.heading - p.prevHeading))
      model.group.position.set(x, 0, z)
      const gaze = p.prevHeading + turn * alpha
      if (!i) followHeading = gaze
      const body = p.prevBodyHeading + (p.bodyHeading - p.prevBodyHeading) * alpha
      const down =
        m.winner !== null && m.winner < 2 && !p.win ? T.MathUtils.smoothstep(this.victoryTime, 0.1, 0.84) : 0
      const bounce =
        down === 1 && this.victoryTime < 1.5
          ? 0.08 * Math.sin((this.victoryTime - 0.84) * 12) * Math.exp(-6 * (this.victoryTime - 0.84))
          : 0
      const proneAngle = [1.64, 2.94, 3.02, 1.53, 1.61, 2.98][p.build.chassis ?? 0]
      const tilt = down * proneAngle + bounce
      model.group.rotation.order = 'YXZ'
      model.group.rotation.set(-tilt, body, 0)
      if (down > 0) {
        if (!this.fallFloor) {
          // The robot lands on its folded hardware. An arm still extended on
          // the last scoring tick should not hold the chassis above the floor.
          model.update({
            time: m.time + 0.68,
            wheelLeft: p.leftTravel,
            wheelRight: p.rightTravel,
            look: gaze - body,
            hand: p.hand,
            energy: p.energy / p.s.capacity
          })
          this.fallFloor = fallSupport(model)
        }
        model.group.position.y = this.fallFloor(tilt)
      }

      const opponent = m.robots[1 - i],
        pose = p.previousPose
      const strike = T.MathUtils.lerp(pose.attack, p.attack, alpha)
      const charge = T.MathUtils.lerp(pose.charge, p.charge, alpha)
      let fire = Math.min(1, strike * 1.27),
        toolContact = null
      if (p.build.weapon < 2) {
        if (p.charge > 0 && strike < 0.01) {
          this.reachPreview ??= { kind: 'hit' }
          this.reachPreview.kind = opponent.guard ? 'guard' : 'hit'
          contactPoint(p, opponent, this.reachPreview, p.windingHand)
          toolContact = this.palmTarget.set(this.reachPreview.x, this.reachPreview.y, this.reachPreview.z)
          fire = Math.max(fire, 0.63 * (1 - T.MathUtils.smoothstep(charge, 0, 0.14)))
        } else if (fire > 0) toolContact = this.palmTarget.set(p.palmX, p.palmY, p.palmZ)
      }
      this.toolAim.set(opponent.x, bodyImpactHeight(opponent.build), opponent.z)
      if (p.build.weapon === 2) {
        const shot = m.shots.find((s) => s.side === i && time - s.start < 0.21)
        if (shot) this.toolAim.set(shot.tx, shot.height, shot.tz)
      }
      const lateral = (p.x - p.prevX) * Math.cos(body) - (p.z - p.prevZ) * Math.sin(body)
      const impact = p.lastImpact
      const impactAngle = impact.bearing - body
      const stagger = T.MathUtils.clamp(8 * impact.points / p.s.hp, 0.2, 1.35)
      fire *= 1 - celebrate
      if (!fire) toolContact = null
      model.update({
        time: p.defeated ? Math.min(time, m.time + 0.68) : time,
        dash:
          m.winner === null && p.maneuver === 'dash'
            ? Math.sin(Math.PI * T.MathUtils.clamp((p.maneuverUntil - time) / 0.38, 0, 1))
            : 0,
        bank: ((1 - celebrate) * T.MathUtils.clamp(lateral / STEP, -3, 3)) / 3,
        wheelLeft: T.MathUtils.lerp(p.prevLeftTravel, p.leftTravel, alpha),
        wheelRight: T.MathUtils.lerp(p.prevRightTravel, p.rightTravel, alpha),
        look: Math.atan2(Math.sin(gaze - body), Math.cos(gaze - body)),
        move: m.winner !== null ? 0 : T.MathUtils.lerp(p.previousPose.move, p.move, alpha),
        attack: T.MathUtils.lerp(p.previousPose.attack, p.attack, alpha) * (1 - celebrate),
        hit: T.MathUtils.lerp(p.previousPose.hit, p.hit, alpha) * (1 - celebrate) * stagger,
        hitFront: Math.cos(impactAngle),
        hitSide: Math.sin(impactAngle),
        guard: T.MathUtils.lerp(p.previousPose.guard, p.guard, alpha) * (1 - celebrate),
        windup: (1 - celebrate) * Math.min(1, charge * 4),
        win: p.win * celebrate,
        hand: p.hand,
        windingHand: p.windingHand,
        toolAim: m.winner === null ? this.toolAim : null,
        fire,
        toolContact,
        palmTarget: toolContact,
        rest: m.winner === null && p.rest,
        energy: p.energy / p.s.capacity
      })
      this.shadows[i].position.set(x, 0.012, z)
      this.shadows[i].rotation.y = model.group.rotation.y
      if (down === 1 && !this.landed) {
        this.landed = true
        this.landedMap = landedContact(model, proneAngle, this.fallFloor(proneAngle), this.landedMap)
        this.shadows[i].material.map = this.landedMap
      }
    }
    const own = this.player.group.position,
      rival = this.enemy.group.position
    this.hall.lightBout(own, rival, m.winner, this.victoryTime, this.reduced)
    const midX = (own.x + rival.x) * 0.5,
      midZ = (own.z + rival.z) * 0.5,
      dist = Math.hypot(own.x - rival.x, own.z - rival.z)
    const distance = this.framingDistance(dist) * (1 + celebrate * 0.13)
    this.nextTarget.set(midX, 0.93, midZ)
    const drifting = !this.reduced && !this.frozen && !this.replayPaused && !this.holdingArena && m.time > 0
    if (this.cam === 0) {
      if (drifting) this.ringsideYaw += dt * 0.105
      // Look down over the terraces, then settle at the rail before "Go".
      // A camera gesture takes ownership even while the clock is stopped.
      const opening = this.reduced ? 0 : T.MathUtils.smoothstep(this.openingTime, .48, 2.3)
      const yaw = this.ringsideYaw + opening * .21
      const radius = distance * (1.07 + opening * .13)
      const lift = ringsideLift(rival.x - own.x, rival.z - own.z, yaw)
      this.ringsideLift = this.cameraSnap ? lift : T.MathUtils.damp(this.ringsideLift, lift, 3.5, dt)
      this.nextCamera.set(
        midX + radius * Math.sin(yaw),
        1.95 + dist * 0.18 + this.ringsideLift + opening * 1.25,
        midZ + radius * Math.cos(yaw)
      )
    } else if (this.cam === 1) {
      const yaw = followHeading - 0.52
      const snap = this.cameraSnap || this.lastDrawnCamera === undefined
      if (snap || this.lastDrawnCamera !== 1) {
        const dx = own.x - this.arenaCam.position.x,
          dz = own.z - this.arenaCam.position.z
        this.chaseYaw = snap ? yaw : Math.atan2(dx, dz)
        this.chaseRadius = snap ? 0 : Math.hypot(dx, dz)
        this.chaseHeight = snap ? 2.26 : this.arenaCam.position.y
      }
      const follow = snap ? 1 : 1 - Math.exp(-dt * 6.6)
      this.chaseYaw += Math.atan2(Math.sin(yaw - this.chaseYaw), Math.cos(yaw - this.chaseYaw)) * follow
      const sin = Math.sin(this.chaseYaw),
        cos = Math.cos(this.chaseYaw)
      const sideways = Math.abs((rival.x - own.x) * cos - (rival.z - own.z) * sin)
      const radius = Math.max(4.05, this.fitArenaWidth(1.84 + sideways))
      this.chaseRadius = Math.max(radius, T.MathUtils.lerp(this.chaseRadius, radius, follow))
      this.chaseHeight = T.MathUtils.lerp(this.chaseHeight, 2.26, follow)
      // Interpolate around the robot. Interpolating world positions takes a
      // shortcut through its head when a circling strategy reverses direction.
      this.nextCamera.set(own.x - sin * this.chaseRadius, this.chaseHeight, own.z - cos * this.chaseRadius)
      this.nextTarget.set(own.x * 0.48 + rival.x * 0.52, 0.98, own.z * 0.48 + rival.z * 0.52)
    } else if (this.cam === 2 && this.showRoutes) {
      const height = Math.max(
        13.0,
        9.0 / (2 * Math.tan(T.MathUtils.degToRad(41 / 2)) * this.arenaCam.aspect * 0.91)
      )
      this.nextTarget.set(0, 0.08, 0)
      this.nextCamera.set(0.02, height, 1.1)
    } else if (this.cam === 2)
      this.nextCamera.set(
        midX + 0.4,
        Math.max(5.6 + dist * 0.64, this.fitArenaWidth(1.68 + dist) + 0.65),
        midZ + 2.4
      )
    else if (this.cam === 4) {
      const model = this.onboardSide ? this.enemy : this.player
      model.lensView(this.nextCamera, this.nextTarget, this.onboardSide ? this.player : this.enemy)
    } else {
      if (drifting && !this.lockCamera) {
        // Resume a gentle orbit after the child lets go. Pitch and zoom
        // stay where they put them, including after a two-finger pinch.
        const idle = (performance.now() - this.orbitReleasedAt) / 1000
        this.orbitYaw += dt * 0.065 * T.MathUtils.smoothstep(idle, 5, 6.2)
      }
      const radius = distance * this.zoom,
        flat = radius * Math.cos(this.orbitPitch)
      this.nextCamera.set(
        midX + Math.sin(this.orbitYaw) * flat,
        0.9 + Math.sin(this.orbitPitch) * radius,
        midZ + Math.cos(this.orbitYaw) * flat
      )
    }
    const fov =
      this.cam === 4 ? verticalLensAngle(m.robots[this.onboardSide].s.field, this.arenaCam.aspect) : 41
    if (this.lensField) this.lensField.update(this.player, a.s.field, this.lensTrial && this.cam !== 4)
    if (this.weaponTrial) {
      this.toolRange.mesh.visible = this.showRoutes && this.cam !== 4
      if (this.toolRange.mesh.visible) this.toolRange.update(this.player.group.position, followHeading, a.inReach)
    }
    if (fov !== this.arenaCam.fov) {
      this.arenaCam.fov = fov
      this.arenaCam.updateProjectionMatrix()
    }
    const smooth = this.cameraSnap || this.cam === 4 ? 1 : 1 - Math.exp(-dt * 4.8)
    this.cameraSnap = false
    this.arenaCam.position.lerp(this.nextCamera, this.cam === 1 ? 1 : smooth)
    this.lastDrawnCamera = this.cam
    this.target.lerp(this.nextTarget, smooth)
    this.arenaCam.lookAt(this.target)
    this.shadowDetail(this.quality < 0.87)
    const reduceMeshes = this.quality < (this.reducedMeshes ? 0.81 : 0.69)
    if (Boolean(this.reducedMeshes) !== reduceMeshes) {
      this.player.setArenaDetail(reduceMeshes)
      this.enemy.setArenaDetail(reduceMeshes)
      this.reducedMeshes = reduceMeshes
    }
    this.floor.setLeanDeck(this.quality < 0.75)
    this.shadowTimer -= dt
    if (this.shadowTimer <= 0) {
      this.arena.userData.key.shadow.needsUpdate = true
      this.shadowTimer = this.quality > 0.75 ? 0.1 : 0.25
    }
    if (this.leanShadows && this.arena.userData.key.shadow.needsUpdate)
      for (const { proxy } of this.shadowModels) proxy.update()
    this.weaponEffects.update(m, time, this.player, this.enemy)
    this.guardPanels.update(m, alpha)
    if (m.winner !== null) this.guardPanels.mesh.visible = false
    this.scuffs.show(time, this.quality >= 0.7)
    if (this.audience) {
      this.audience.group.visible = this.quality >= 0.7
      if (this.audience.group.visible) {
        const excitement = this.reduced ? 0 : m.winner === null ? this.cheer : 0.95
        this.audience.update(m.time + this.victoryTime, excitement, this.arenaCam.position, this.arenaCam)
      }
      this.cheer = 0
    }
    this.fx.update(this.replayPaused ? 0 : dt * this.replaySpeed, this.arenaCam)
    this.renderer.render(this.arena, this.arenaCam)
    this.headLabels.update(
      m,
      this.arenaCam,
      this.labelModels,
      this.width,
      this.height,
      this.cam === 4 ? this.onboardSide : -1,
      floorReady
    )
  }
}
