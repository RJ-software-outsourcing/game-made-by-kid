// Small depth-buffered renderer for the six instruments. The cached canvases
// contain the current view of the solid meshes and are invalidated on rotation.
CastleScenes["meridian-renderer"] = (() => {
  const materials = {
    slate: [[72, 77, 87], 0.19, 0.37],
    iron: [[54, 53, 50], 0.48, 0.22],
    bronze: [[91, 73, 54], 0.65, 0.26],
    edge: [[141, 117, 84], 0.8, 0.19],
    mark: [[198, 171, 112], 0.5, 0.29],
    silver: [[47, 56, 68], 1.45, 0.075],
    gold: [[208, 145, 54], 0.85, 0.22],
    moon: [[160, 188, 209], 0.89, 0.19],
    jade: [[77, 166, 135], 0.65, 0.2],
    amber: [[106, 62, 24], 0.92, 0.08],
    ice: [[48, 76, 105], 1.0, 0.075],
    turquoise: [[33, 81, 77], 1, 0.08],
  };
  const keys = Object.keys(materials);
  const defs = Object.values(materials);
  const M = Object.fromEntries(keys.map((n, i) => [n, i]));
  const shadowSize = 112,
    shadowLeft = -1.48,
    shadowBack = -1.45,
    shadowWidth = 6,
    shadowDepth = 4.8;
  function canvas(w, h) {
    const out = document.createElement("canvas");
    out.width = w;
    out.height = h;
    return out;
  }
  const unit = (x, y, z) => {
    const h = Math.hypot(x, y, z) || 1;
    return [x / h, y / h, z / h];
  };
  const moon = unit(-1.11, -0.58, 1);
  const warm = unit(0.86, -0.07, 0.36);
  let photo, grain, probeWidth, probeHeight;
  function readProbe() {
    if (photo) return;
    const p = CastleScenes["meridian-probe"];
    const bytes = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
    probeWidth = p.width;
    probeHeight = p.height;
    photo = bytes(p.sky);
    grain = bytes(p.stone);
  }
  // Store material and texture coordinates once. Geometry and normals rotate
  // together, while the sky probe and warm side light stay fixed in the room.
  function prepare(builder) {
    const nv = builder.vertices.length,
      source = new Float32Array(nv * 7),
      mt = new Uint8Array(nv);
    builder.vertices.forEach((p, i) => source.set(p, i * 7));
    const idx = new Uint16Array(builder.triangles.length * 3);
    builder.triangles.forEach(([a, b, c, m], i) => {
      idx.set([a, b, c], 3 * i);
      mt[a] = mt[b] = mt[c] = M[m];
    });
    return { nv, source, mt, idx };
  }
  function environment(x, y, z) {
    const u = (0.5 + Math.atan2(x, -y) / (2 * Math.PI)) * probeWidth,
      v = Math.max(0, Math.min(probeHeight - 1.001, (1 - z) * (probeHeight - 1) * 0.5));
    const ix = Math.floor(u),
      iy = Math.floor(v),
      fx = u - ix,
      fy = v - iy;
    const a = (iy * probeWidth + ((ix + probeWidth) % probeWidth)) * 3,
      b = (iy * probeWidth + ((ix + probeWidth + 1) % probeWidth)) * 3;
    const result = [];
    for (let k = 0; k < 3; k++) {
      const hi = photo[a + k] * (1 - fx) + photo[b + k] * fx,
        lo = photo[a + probeWidth * 3 + k] * (1 - fx) + photo[b + probeWidth * 3 + k] * fx;
      result[k] = hi + (lo - hi) * fy;
    }
    return result;
  }
  // Raster coordinates are shared by the shadow map and the colour pass.
  function triangles(indices, positions, width, height, depth, pixel) {
    for (let i = 0; i < indices.length; i += 3) {
      const ia = indices[i],
        ib = indices[i + 1],
        ic = indices[i + 2];
      const a = 3 * ia,
        b = 3 * ib,
        c = 3 * ic,
        ax = positions[a],
        ay = positions[a + 1],
        dx1 = positions[b] - ax,
        dy1 = positions[b + 1] - ay,
        dx2 = positions[c] - ax,
        dy2 = positions[c + 1] - ay;
      const det = dx1 * dy2 - dx2 * dy1;
      if (Math.abs(det) < 0.001) continue;
      const x0 = Math.max(0, Math.ceil(Math.min(ax, positions[b], positions[c]) - 0.5));
      const x1 = Math.min(width - 1, Math.floor(Math.max(ax, positions[b], positions[c]) - 0.5));
      const y0 = Math.max(0, Math.ceil(Math.min(ay, positions[b + 1], positions[c + 1]) - 0.5));
      const y1 = Math.min(height - 1, Math.floor(Math.max(ay, positions[b + 1], positions[c + 1]) - 0.5));
      const ux = dy2 / det,
        uy = -dx2 / det,
        vx = -dy1 / det,
        vy = dx1 / det,
        az = positions[a + 2],
        uz = positions[b + 2] - az,
        vz = positions[c + 2] - az;
      for (let y = y0; y <= y1; y++) {
        let u = (x0 + 0.5 - ax) * ux + (y + 0.5 - ay) * uy,
          v = (x0 + 0.5 - ax) * vx + (y + 0.5 - ay) * vy;
        for (let x = x0; x <= x1; x++, u += ux, v += vx) {
          if (u < -0.00001 || v < -0.00001 || u + v > 1.00001) continue;
          const z = az + uz * u + vz * v,
            offset = y * width + x;
          if (z <= depth[offset]) continue;
          depth[offset] = z;
          if (pixel) pixel(offset, ia, ib, ic, u, v);
        }
      }
    }
  }
  function instrument(model) {
    const { nv, source, mt, idx } = model,
      screen = new Float32Array(nv * 3),
      shadowPts = new Float32Array(nv * 3);
    const world = new Float32Array(nv * 6),
      colors = new Float32Array(nv * 3),
      uv = new Float32Array(nv * 2);
    const shadowDepths = new Float32Array(shadowSize ** 2);
    const cast = canvas(shadowSize, shadowSize),
      cg = cast.getContext("2d"),
      mask = cg.createImageData(shadowSize, shadowSize);
    const image = canvas(1, 1),
      g = image.getContext("2d");
    let previous = "",
      coordinates,
      buffer,
      depth;
    for (let i = 0; i < nv; i++) {
      const j = 7 * i;
      uv[i * 2] = source[j] * 76 + source[j + 1] * 39 + source[j + 2] * 11;
      uv[i * 2 + 1] = source[j + 2] * 79 - source[j + 1] * 32 + source[j] * 13;
    }
    function render(angle, lean, slope, perspective, scale, powered) {
      const signature = [
        angle.toFixed(4),
        Math.round(lean * 150),
        Math.round(slope * 130),
        Math.round(perspective * 2000),
        scale,
        powered,
      ].join("/");
      if (signature === previous) return coordinates;
      previous = signature;
      const cos = Math.cos(angle),
        sin = Math.sin(angle),
        view = unit(-lean, 1, slope);
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
      for (let i = 0; i < nv; i++) {
        const k = 7 * i,
          j = 6 * i,
          d = 3 * i,
          rot = source[k + 6],
          co = rot ? cos : 1,
          si = rot ? sin : 0;
        const x = co * source[k] - si * source[k + 1],
          y = si * source[k] + co * source[k + 1],
          z = source[k + 2];
        world[j] = x;
        world[j + 1] = y;
        world[j + 2] = z;
        world[j + 3] = co * source[k + 3] - si * source[k + 4];
        world[j + 4] = si * source[k + 3] + co * source[k + 4];
        world[j + 5] = source[k + 5];
        const zoom = scale / (1 - perspective * y);
        const u = (x + lean * y) * zoom,
          v = (slope * y - z) * zoom;
        screen[d] = u;
        screen[d + 1] = v;
        screen[d + 2] = y;
        minX = Math.min(minX, u);
        maxX = Math.max(maxX, u);
        minY = Math.min(minY, v);
        maxY = Math.max(maxY, v);
        shadowPts[d] = ((x + 1.11 * z - shadowLeft) * shadowSize) / shadowWidth;
        shadowPts[d + 1] = ((y + 0.58 * z - shadowBack) * shadowSize) / shadowDepth;
        shadowPts[d + 2] = z;
      }
      minX = Math.floor(minX) - 1;
      minY = Math.floor(minY) - 1;
      const width = Math.ceil(maxX) - minX + 2,
        height = Math.ceil(maxY) - minY + 2;
      if (image.width !== width || image.height !== height) {
        image.width = width;
        image.height = height;
        buffer = g.createImageData(width, height);
        depth = new Float32Array(width * height);
      } else buffer.data.fill(0);
      depth.fill(-Infinity);
      shadowDepths.fill(-Infinity);
      triangles(idx, shadowPts, shadowSize, shadowSize, shadowDepths);
      // The same light-space depth pass supplies self-shadowing and the
      // silhouette on the stone under the instrument, including its open fork.
      for (let y = 0; y < shadowSize; y++)
        for (let x = 0; x < shadowSize; x++) {
          const k = y * shadowSize + x,
            h = shadowDepths[k];
          let n = 0;
          for (const d of [-shadowSize - 1, -shadowSize, 1, 0, -1, shadowSize, shadowSize + 1])
            if (shadowDepths[k + d] > -0.01) n++;
          mask.data[k * 4 + 3] = Math.round(n * (h < 0.16 ? 17 : 12.8));
        }
      cg.putImageData(mask, 0, 0);
      for (let i = 0; i < nv; i++) {
        const j = 6 * i,
          d = 3 * i,
          mat = mt[i],
          def = defs[mat],
          base = def[0],
          metal = def[1],
          rough = def[2];
        screen[d] -= minX;
        screen[d + 1] -= minY;
        const x = world[j],
          y = world[j + 1],
          z = world[j + 2];
        let nx = world[j + 3],
          ny = world[j + 4],
          nz = world[j + 5];
        // Silver is shaded from its curved normal at each visible pixel.
        if (mat === M.silver) continue;
        const facing = nx * view[0] + ny * view[1] + nz * view[2];
        if (facing < 0) {
          nx = -nx;
          ny = -ny;
          nz = -nz;
        }
        const eye = unit(view[0] - x * 0.055, view[1] - y * 0.055, view[2] - (z - 1) * 0.055);
        const nvEye = Math.max(0, nx * eye[0] + ny * eye[1] + nz * eye[2]);
        const rx = 2 * nvEye * nx - eye[0],
          ry = 2 * nvEye * ny - eye[1],
          rz = 2 * nvEye * nz - eye[2];
        const env = environment(rx, ry, rz);
        const smx = Math.max(1, Math.min(shadowSize - 2, Math.floor(shadowPts[d]))),
          smy = Math.max(1, Math.min(shadowSize - 2, Math.floor(shadowPts[d + 1])));
        const k = smy * shadowSize + smx;
        let visible = 0.2;
        for (const o of [0, 1, -shadowSize, shadowSize]) if (shadowDepths[k + o] <= z + 0.075) visible += 0.2;
        const key = Math.max(0, nx * moon[0] + ny * moon[1] + nz * moon[2]) * visible;
        const side = Math.max(0, nx * warm[0] + ny * warm[1] + nz * warm[2]);
        const sky = 0.41 + 0.15 * nz,
          occlusion = 0.76 + 0.24 * Math.min(1, z / 0.49);
        const reflect = Math.max(0, rx * moon[0] + ry * moon[1] + rz * moon[2]);
        const lamp = Math.max(0, rx * warm[0] + ry * warm[1] + rz * warm[2]);
        const spec = metal * (255 * reflect ** (12 / rough) * visible + 46 * reflect ** 8);
        const amber = metal * 153 * lamp ** (8 / rough),
          fresnel = (1 - nvEye) ** 3;
        const glass = mat === M.amber || mat === M.ice || mat === M.turquoise;
        for (let ch = 0; ch < 3; ch++) {
          const diffuse = (sky + key * (0.69 + 0.09 * ch) + side * (0.32 - 0.09 * ch)) * occlusion;
          const reflection = env[ch] * metal * (0.48 + 0.35 * fresnel);
          colors[d + ch] =
            base[ch] * diffuse +
            reflection +
            spec * (0.86 + 0.07 * ch) +
            amber * (1 - 0.28 * ch) +
            (glass ? base[ch] * (powered ? 0.9 : 0.12) * (1 - 0.48 * nvEye) : 0);
        }
      }
      const bytes = buffer.data;
      triangles(idx, screen, width, height, depth, (offset, a, b, c, u, v) => {
        const j = 2 * a,
          uu = uv[j] + u * (uv[2 * b] - uv[j]) + v * (uv[2 * c] - uv[j]);
        const vv = uv[j + 1] + u * (uv[2 * b + 1] - uv[j + 1]) + v * (uv[2 * c + 1] - uv[j + 1]);
        const gr = grain[((Math.floor(vv) & 63) << 6) + (Math.floor(uu) & 63)] / 255 - 0.5;
        const mat = mt[a];
        if (mat === M.silver) {
          const w = 1 - u - v,
            ix = 7 * a,
            iy = 7 * b,
            iz = 7 * c;
          const lx = source[ix] * w + source[iy] * u + source[iz] * v;
          const lz = source[ix + 2] * w + source[iy + 2] * u + source[iz + 2] * v;
          const sign = source[ix + 1] > 0 ? 1 : -1;
          const height =
            lz - CastleScenes["meridian-models"].beamHeight / CastleScenes["meridian-models"].radius;
          // Resolve the sky reflection per pixel using the polished dish normal.
          const curvature = 2 * CastleScenes["meridian-models"].sag,
            xx = -curvature * lx,
            zz = -curvature * height;
          let nx = xx * cos - sign * sin,
            ny = xx * sin + sign * cos,
            nz = zz;
          let inv = 1 / Math.hypot(nx, ny, nz);
          nx *= inv;
          ny *= inv;
          nz *= inv;
          let vx = view[0] - 0.093 * lx * cos,
            vy = view[1] - 0.093 * lx * sin,
            vz = view[2] - 0.093 * height;
          inv = 1 / Math.hypot(vx, vy, vz);
          vx *= inv;
          vy *= inv;
          vz *= inv;
          const dot = nx * vx + ny * vy + nz * vz,
            rx = 2 * dot * nx - vx,
            ry = 2 * dot * ny - vy,
            rz = 2 * dot * nz - vz;
          const env = environment(rx, ry, rz),
            glint = Math.max(0, rx * moon[0] + ry * moon[1] + rz * moon[2]) ** 90;
          const rim = Math.max(0, Math.hypot(lx, height) - 0.75);
          for (let ch = 0; ch < 3; ch++)
            bytes[offset * 4 + ch] = 13 + ch * 3 + env[ch] * 1.57 + rim * 33 + glint * 139 + gr * 5;
          bytes[offset * 4 + 3] = 255;
          return;
        }
        const variation = 1 + gr * (mat === M.slate ? 0.79 : 0.265);
        const aa = 3 * a,
          bb = 3 * b,
          cc = 3 * c,
          oo = offset * 4;
        for (let k = 0; k < 3; k++) {
          const val =
            colors[aa + k] + u * (colors[bb + k] - colors[aa + k]) + v * (colors[cc + k] - colors[aa + k]);
          bytes[oo + k] = val * variation;
        }
        bytes[oo + 3] = 255;
      });
      g.putImageData(buffer, 0, 0);
      coordinates = {
        image,
        cast,
        depth,
        scale,
        minX: minX / scale,
        minY: minY / scale,
        w: width / scale,
        h: height / scale,
      };
      return coordinates;
    }
    return { render };
  }
  function create(s, layout) {
    readProbe();
    const models = CastleScenes["meridian-models"],
      r = models.radius;
    const mirror = prepare(models.mirror());
    const rail = models.rail(layout);
    const channel = instrument(prepare(rail.mesh));
    const fixtures = [
      ...layout.mounts.map((p, i) => ({ p, i, mirror: true, body: instrument(mirror) })),
      ...layout.targets.map((p, i) => ({
        p,
        i,
        mirror: false,
        body: instrument(prepare(models.receiver(i))),
      })),
    ].sort((a, b) => a.p.y - b.p.y);
    function frame(c, angles, target) {
      return fixtures.map((f) => {
        const { p, i } = f,
          foot = c.project(p),
          ahead = c.project({ x: p.x, y: p.y + 0.0001 });
        const lean = (ahead.x - foot.x) / (0.0001 * foot.size),
          slope = (ahead.y - foot.y) / (0.0001 * foot.size);
        const size = foot.size * r,
          scale = Math.max(
            36,
            Math.min(160, Math.ceil((size * (window.devicePixelRatio || 1) * 1.2) / 12) * 12),
          );
        // The receivers' glass is omnidirectional, their engraved front faces the entry.
        const a = f.mirror ? angles[i] : 0;
        const body = f.body.render(
          a,
          lean,
          slope,
          ((1 - foot.size / ahead.size) * r) / 0.0001,
          scale,
          !f.mirror && target === i,
        );
        const draw = () =>
          s.ctx.drawImage(
            body.image,
            foot.x + size * body.minX,
            foot.y + size * body.minY,
            size * body.w,
            size * body.h,
          );
        const hides = (screen, point) => {
          const x = Math.floor(((screen.x - foot.x) / size - body.minX) * scale);
          const y = Math.floor(((screen.y - foot.y) / size - body.minY) * scale);
          if (x < 0 || y < 0 || x >= body.image.width || y >= body.image.height) return false;
          return body.depth[y * body.image.width + x] > (point.y - p.y) / r + 0.045;
        };
        return { ...f, foot, body, size, draw, hides };
      });
    }
    function drawRail(c) {
      const p = rail.center,
        foot = c.project(p),
        ahead = c.project({ x: p.x, y: p.y + 0.0001 });
      const lean = (ahead.x - foot.x) / (0.0001 * foot.size),
        slope = (ahead.y - foot.y) / (0.0001 * foot.size);
      const size = foot.size * rail.radius;
      const scale = Math.min(360, Math.max(96, Math.ceil((size * (window.devicePixelRatio || 1)) / 24) * 24));
      const body = channel.render(
        0,
        lean,
        slope,
        ((1 - foot.size / ahead.size) * rail.radius) / 0.0001,
        scale,
        false,
      );
      s.ctx.drawImage(
        body.image,
        foot.x + size * body.minX,
        foot.y + size * body.minY,
        size * body.w,
        size * body.h,
      );
    }
    function groundLight(c, f) {
      const { p, foot, size, body, draw } = f,
        g = s.ctx;
      if (s.game.effects()) {
        g.save();
        g.translate(0, foot.y + 1);
        g.scale(1, -0.38);
        g.translate(0, -foot.y);
        g.globalAlpha = 0.19;
        draw();
        g.restore();
      }
      // Lay the soft shadow on the photographed floor with the same projective
      // foreshortening used for the mounting points.
      for (let y = 0; y < shadowSize; y += 4) {
        const at = (x, y) =>
          c.project({
            x: p.x + r * (shadowLeft + (shadowWidth * x) / shadowSize),
            y: p.y + r * (shadowBack + (shadowDepth * y) / shadowSize),
          });
        const a = at(0, y),
          b = at(shadowSize, y),
          d = at(0, y + 4);
        g.save();
        g.transform(b.x - a.x, 0, d.x - a.x, d.y - a.y, a.x, a.y);
        g.drawImage(body.cast, 0, y, shadowSize, 4, 0, 0, 1, 1.025);
        g.restore();
      }
      s.shadow(foot.x, foot.y, size * 0.9, size * 0.24, 0.42);
    }
    return { frame, groundLight, drawRail };
  }
  return { create };
})();
