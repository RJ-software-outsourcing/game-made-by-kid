// Run with Playwright WebKit and Python (Pillow, NumPy) installed. PLAYWRIGHT_MODULE may point
// to an existing Playwright installation. No server or external assets needed.
import { execFileSync } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile, mkdir, copyFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const { webkit } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const game = new URL('../', import.meta.url)
const origin = 'http://part-lightbox.test/'
const browser = await webkit.launch()
const scratch = await mkdtemp(join(tmpdir(), 'rally-parts-'))
const output = process.argv[2] || fileURLToPath(new URL('art/', game))
try {
  const page = await browser.newPage({ serviceWorkers: 'block' })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })
  await page.route('**/*', async route => {
    const url = route.request().url()
    if (url === origin) return route.fulfill({ contentType: 'text/html', body: '<title>Part lightbox</title>' })
    if (!url.startsWith(origin)) return route.abort()
    const source = new URL(url.slice(origin.length), game)
    if (!source.href.startsWith(game.href)) return route.abort()
    return route.fulfill({ contentType: source.pathname.endsWith('.webp') ? 'image/webp' : 'text/javascript', body: await readFile(source) })
  })
  await page.goto(origin)
  await page.evaluate(async () => {
    const T = await import('/vendor/three.module.js')
    const { createRobot } = await import('/js/robot.js')
    const { frames, slots, starter } = await import('/js/catalog.js')
    const { paints } = await import('/js/palette.js')
    const { createWorkshopFinish } = await import('/js/workshop-finish.js')
    const renderer = new T.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true })
    renderer.setClearColor(0x000000, 0)
    renderer.toneMapping = T.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.04
    const scene = new T.Scene(), finish = createWorkshopFinish()
    const { workshopProbe } = await import('/js/workshop-light.js')
    const studio = await new T.TextureLoader().loadAsync('/art/garage-light.webp')
    scene.environment = workshopProbe(studio, renderer)
    scene.add(new T.HemisphereLight(0xffefd8, 0x536463, .96))
    for (const [color, intensity, x, y, z] of [[0xffecca, 2.3, 3, 5, 3], [0xc7ebf2, 1.58, -3, 2, -1], [0xffe0aa, 1.5, 2, 1, -3]]) {
      const light = new T.DirectionalLight(color, intensity)
      light.position.set(x, y, z)
      scene.add(light)
    }
    const width = 160, height = 120
    renderer.setSize(width * 3, height * 3, false)
    const camera = new T.OrthographicCamera(-1, 1, 1, -1, .001, 32)
    const v = new T.Vector3(), matrix = new T.Matrix4()
    function boundsInCamera(item) {
      const box = new T.Box3()
      for (const mesh of item.children) {
        const { attributes, index, drawRange } = mesh.geometry
        matrix.multiplyMatrices(camera.matrixWorldInverse, mesh.matrixWorld)
        const end = Math.min(index?.count ?? attributes.position.count, drawRange.start + drawRange.count)
        for (let j = drawRange.start; j < end; j++) {
          v.fromBufferAttribute(attributes.position, index ? index.getX(j) : j).applyMatrix4(matrix)
          box.expandByPoint(v)
        }
      }
      return box
    }
    const angles = { brain: [.73, 1.02, 1.13], motor: [1.3, .43, .70], cell: [.72, .53, -1.27], shell: [.46, .41, 1.38], lens: [.42, .28, 1.35], weapon: [.78, .58, 1.04] }
    window.frameNames = frames.map(f => f.name.toLowerCase())
    window.paintNames = paints.map(p => p[0])
    window.bake = chassis => {
      const contexts = paints.map(() => {
        const atlas = document.createElement('canvas')
        atlas.width = width * 4
        atlas.height = height * slots.length
        const ctx = atlas.getContext('2d')
        ctx.imageSmoothingQuality = 'high'
        return ctx
      })
      const bot = createRobot({ ...starter, chassis }, paints[0][2])
      for (const [row, { id }] of slots.entries()) for (let tier = 0; tier < 4; tier++) {
        bot.setBuild({ ...starter, chassis, [id]: tier })
        bot.update({ time: 1.25 })
        bot.group.updateMatrixWorld(true)
        const item = new T.Group()
        let pieces = bot.shadowParts().filter(piece => piece.part === id)
        if (id === 'motor') {
          // Photograph the outer hub of the leading right wheel. Mirrored and
          // trailing copies in the same kit would hide the tire detail.
          const wheels = pieces.filter(part => part.node.name === 'Tire, rim and hub')
          if (wheels.length) pieces = [wheels.sort((a, b) => b.node.matrixWorld.elements[12] - a.node.matrixWorld.elements[12])[0]]
        }
        for (const { node, geometry } of pieces) {
          const mesh = new T.Mesh(geometry, finish)
          mesh.applyMatrix4(node.matrixWorld)
          item.add(mesh)
        }
        // The armor kit consists of paired side panels. Photograph one flank
        // at close range so its padding, plates or honeycomb read at 60px.
        if (id === 'shell') {
          for (const mesh of item.children) {
            const geometry = mesh.geometry, pos = geometry.attributes.position, indices = geometry.index
            let start = indices.count
            while (start >= 3 && [1, 2, 3].every(n => pos.getX(indices.getX(start - n)) > .025)) start -= 3
            if (start < indices.count - 12) {
              const flank = geometry.clone()
              flank.setAttribute('color', geometry.attributes.color)
              flank.setDrawRange(start, indices.count - start)
              mesh.geometry = flank
              mesh.userData.owned = true
            }
          }
        }
        scene.add(item)
        item.updateMatrixWorld(true)
        camera.position.set(...angles[id]).normalize().multiplyScalar(8)
        camera.up.set(id === 'lens' ? .22 : 0, 1, 0)
        camera.lookAt(0, 0, 0)
        camera.updateMatrixWorld(true)
        const bounds = boundsInCamera(item)
        if (bounds.isEmpty()) throw Error(`Missing ${frames[chassis].name}/${id}/${tier}`)
        const dimensions = bounds.getSize(new T.Vector3()), center = bounds.getCenter(new T.Vector3())
        const h = Math.max(dimensions.y, dimensions.x * height / width) * 1.13
        const w = h * width / height
        camera.left = center.x - w / 2; camera.right = center.x + w / 2
        camera.top = center.y + h / 2; camera.bottom = center.y - h / 2
        camera.updateProjectionMatrix()
        for (const [swatch, ctx] of contexts.entries()) {
          bot.setPaint(paints[swatch][2])
          // The live robot uploads packed chest/head buffers. These isolated
          // product shots use the original sections from shadowParts instead.
          for (const mesh of item.children) mesh.geometry.attributes.color.needsUpdate = true
          renderer.render(scene, camera)
          ctx.save()
          ctx.translate((tier + .5) * width, (row + .5) * height + .47 * height * dimensions.y / h)
          ctx.scale(.42 * width * dimensions.x / w, 4)
          const shadow = ctx.createRadialGradient(0, 0, 0, 0, 0, 1)
          shadow.addColorStop(0, 'rgba(21,36,36,.24)')
          shadow.addColorStop(1, 'rgba(21,36,36,0)')
          ctx.fillStyle = shadow
          ctx.fillRect(-1, -1, 2, 2)
          ctx.restore()
          ctx.drawImage(renderer.domElement, tier * width, row * height, width, height)
        }
        scene.remove(item)
        for (const mesh of item.children) if (mesh.userData.owned) mesh.geometry.dispose()
      }
      bot.dispose()
      return contexts.map(ctx => ctx.canvas.toDataURL('image/png').split(',')[1])
    }
  })
  const { frames, paints } = await page.evaluate(() => ({ frames: window.frameNames, paints: window.paintNames }))
  const packer = fileURLToPath(new URL('pack-part-palettes.py', import.meta.url))
  const files = []
  for (const [index, name] of frames.entries()) {
    if (process.argv[3] && process.argv[3] !== name) continue
    const source = join(scratch, name)
    await mkdir(source)
    const variants = await page.evaluate(i => window.bake(i), index)
    for (const [i, png] of variants.entries()) await writeFile(join(source, paints[i] + '.png'), Buffer.from(png, 'base64'))
    const filename = `kit-${name}.png`
    execFileSync('python3', [packer, source, join(scratch, filename), ...paints], { stdio: 'inherit' })
    files.push(filename)
  }
  if (errors.length) throw Error(errors.join('\n'))
  await mkdir(output, { recursive: true })
  for (const file of files) await copyFile(join(scratch, file), join(output, file))
  console.log(`Baked ${files.length * 24} part portraits into ${output}`)
} finally {
  await browser.close()
  await rm(scratch, { recursive: true, force: true })
}
