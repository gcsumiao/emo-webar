"""Region-based coloring of the GLB.

1. Find connected components of the mesh (custom BFS, no slow `separate` op).
2. For each component, sample the reference PNG at its projected centroid.
3. Snap that sample to a small fixed palette derived from the PNG itself
   (body pink, cloud white, dark feature, stem brown). This gives crisp,
   distinct regions for body, eyes/eyebrows/mouth, cheek-clouds, and stem
   without depending on perfect mesh<->image pixel alignment.
4. Write per-vertex colors as the COLOR_0 attribute and export GLB.
"""
import json
import socket
import sys

GLB = "/Users/sumiaoc/Downloads/emo-checklist/2.AR角色素材/1.3D模型文件-GLB/一毛坐姿.glb"
IMG = "/Users/sumiaoc/Downloads/emo-checklist/2.AR角色素材/2.一毛动画工程文件/emo3D动画黑色背景（png帧序列+MP4）/png/1_0300.png"
OUT_GLB = "/Users/sumiaoc/Downloads/emo-checklist/2.AR角色素材/1.3D模型文件-GLB/一毛坐姿_regions.glb"
OUT_PNG = "/Users/sumiaoc/Downloads/emo-checklist/2.AR角色素材/1.3D模型文件-GLB/一毛坐姿_regions_preview.png"

CODE = r'''
import bpy, math, traceback
import numpy as np
from mathutils import Vector

GLB = {GLB!r}
IMG = {IMG!r}
OUT_GLB = {OUT_GLB!r}
OUT_PNG = {OUT_PNG!r}

def L(*a): print(*a)

try:
    # 1. Reset and import
    for o in list(bpy.data.objects):
        if o.type in {{"MESH", "LIGHT", "CAMERA"}}:
            bpy.data.objects.remove(o, do_unlink=True)
    bpy.ops.import_scene.gltf(filepath=GLB)
    mesh_objs = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    bpy.ops.object.select_all(action="DESELECT")
    for o in mesh_objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = mesh_objs[0]
    if len(mesh_objs) > 1:
        bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    me = obj.data
    n_verts = len(me.vertices)
    L("verts", n_verts, "edges", len(me.edges), "polys", len(me.polygons))

    # 2. Image: detect pink-body bbox, derive palette
    img = bpy.data.images.load(IMG, check_existing=True)
    W, H = img.size[0], img.size[1]
    arr = np.array(img.pixels[:], dtype=np.float32).reshape(H, W, 4)
    r_ch = arr[..., 0]; g_ch = arr[..., 1]; b_ch = arr[..., 2]

    pink_mask = (r_ch > g_ch + 0.04) & (r_ch > b_ch + 0.04) & (r_ch > 0.3)
    ys2, xs2 = np.where(pink_mask)
    px_x_min, px_x_max = int(xs2.min()), int(xs2.max())
    px_y_min, px_y_max = int(ys2.min()), int(ys2.max())
    L("pink_bbox_px", px_x_min, px_y_min, px_x_max, px_y_max)

    # Palette extracted from the image
    body_pink = (float(r_ch[pink_mask].mean()),
                 float(g_ch[pink_mask].mean()),
                 float(b_ch[pink_mask].mean()))
    bright_mask = (r_ch + g_ch + b_ch > 2.7) & pink_mask  # ~white inside char bbox
    if bright_mask.sum() > 50:
        cloud_white = (float(r_ch[bright_mask].mean()),
                       float(g_ch[bright_mask].mean()),
                       float(b_ch[bright_mask].mean()))
    else:
        cloud_white = (0.97, 0.95, 0.93)
    # Dark inside char bbox
    inside = np.zeros_like(pink_mask)
    inside[px_y_min:px_y_max+1, px_x_min:px_x_max+1] = True
    dark_mask = inside & (r_ch + g_ch + b_ch < 0.5)
    if dark_mask.sum() > 20:
        dark = (float(r_ch[dark_mask].mean()),
                float(g_ch[dark_mask].mean()),
                float(b_ch[dark_mask].mean()))
    else:
        dark = (0.15, 0.10, 0.10)
    # Brown stem: warm-ish, R > G > B, mid-brightness
    stem_mask = inside & (r_ch > g_ch + 0.05) & (g_ch > b_ch + 0.03) & (r_ch < 0.85) & (r_ch > 0.25)
    if stem_mask.sum() > 50:
        stem_brown = (float(r_ch[stem_mask].mean()),
                      float(g_ch[stem_mask].mean()),
                      float(b_ch[stem_mask].mean()))
    else:
        stem_brown = (0.55, 0.35, 0.20)
    L("palette body", tuple(round(c,3) for c in body_pink),
      "cloud", tuple(round(c,3) for c in cloud_white),
      "dark", tuple(round(c,3) for c in dark),
      "stem", tuple(round(c,3) for c in stem_brown))
    palette = np.array([body_pink, cloud_white, dark, stem_brown], dtype=np.float32)
    palette_names = ["body", "cloud", "dark", "stem"]

    # 3. World coords of vertices
    co_arr = np.empty(n_verts * 3, dtype=np.float32)
    me.vertices.foreach_get("co", co_arr)
    co_arr = co_arr.reshape(n_verts, 3)
    mw_np = np.array([list(row) for row in obj.matrix_world], dtype=np.float32)
    co_h = np.concatenate([co_arr, np.ones((n_verts,1), dtype=np.float32)], axis=1)
    co_w = (co_h @ mw_np.T)[:, :3]
    x_min, x_max = float(co_w[:,0].min()), float(co_w[:,0].max())
    z_min, z_max = float(co_w[:,2].min()), float(co_w[:,2].max())
    x_rng = max(x_max - x_min, 1e-6)
    z_rng = max(z_max - z_min, 1e-6)

    # 4. Connected components via BFS over edges
    n_edges = len(me.edges)
    edge_pairs = np.empty(n_edges * 2, dtype=np.int32)
    me.edges.foreach_get("vertices", edge_pairs)
    edge_pairs = edge_pairs.reshape(n_edges, 2)
    # adjacency arrays
    adj_starts = np.zeros(n_verts + 1, dtype=np.int32)
    np.add.at(adj_starts, edge_pairs[:,0] + 1, 1)
    np.add.at(adj_starts, edge_pairs[:,1] + 1, 1)
    np.cumsum(adj_starts, out=adj_starts)
    adj = np.empty(adj_starts[-1], dtype=np.int32)
    fill = adj_starts[:-1].copy()
    for a, b in edge_pairs:
        adj[fill[a]] = b; fill[a] += 1
        adj[fill[b]] = a; fill[b] += 1

    component = np.full(n_verts, -1, dtype=np.int32)
    comp_id = 0
    for start in range(n_verts):
        if component[start] != -1:
            continue
        component[start] = comp_id
        stack = [start]
        while stack:
            v = stack.pop()
            s, e = adj_starts[v], adj_starts[v+1]
            for u in adj[s:e]:
                if component[u] == -1:
                    component[u] = comp_id
                    stack.append(int(u))
        comp_id += 1
    n_comp = comp_id
    L("n_components", n_comp)

    # 5. For each component: bbox in world XZ, project to image, sample, snap to palette
    comp_color = np.empty((n_comp, 3), dtype=np.float32)
    comp_size = np.zeros(n_comp, dtype=np.int32)
    np.add.at(comp_size, component, 1)
    # Per-component world bounds via numpy
    comp_x_min = np.full(n_comp,  np.inf, dtype=np.float32)
    comp_x_max = np.full(n_comp, -np.inf, dtype=np.float32)
    comp_z_min = np.full(n_comp,  np.inf, dtype=np.float32)
    comp_z_max = np.full(n_comp, -np.inf, dtype=np.float32)
    np.minimum.at(comp_x_min, component, co_w[:,0])
    np.maximum.at(comp_x_max, component, co_w[:,0])
    np.minimum.at(comp_z_min, component, co_w[:,2])
    np.maximum.at(comp_z_max, component, co_w[:,2])

    sampled_rgb = np.zeros((n_comp, 3), dtype=np.float32)
    for c in range(n_comp):
        fxa = (comp_x_min[c] - x_min) / x_rng
        fxb = (comp_x_max[c] - x_min) / x_rng
        fza = (comp_z_min[c] - z_min) / z_rng
        fzb = (comp_z_max[c] - z_min) / z_rng
        pxa = int(round(px_x_min + fxa * (px_x_max - px_x_min)))
        pxb = int(round(px_x_min + fxb * (px_x_max - px_x_min)))
        pya = int(round(px_y_min + fza * (px_y_max - px_y_min)))
        pyb = int(round(px_y_min + fzb * (px_y_max - px_y_min)))
        pxa, pxb = max(0,min(W-1,pxa)), max(0,min(W-1,pxb))
        pya, pyb = max(0,min(H-1,pya)), max(0,min(H-1,pyb))
        if pxb < pxa: pxa,pxb = pxb,pxa
        if pyb < pya: pya,pyb = pyb,pya
        if pxb == pxa: pxb = min(W-1, pxa+1)
        if pyb == pya: pyb = min(H-1, pya+1)
        region = arr[pya:pyb+1, pxa:pxb+1, :3]
        sampled_rgb[c] = region.reshape(-1, 3).mean(axis=0)

    # Classify each component by sampled color via HSV-style rules.
    sr = sampled_rgb[:, 0]; sg = sampled_rgb[:, 1]; sb = sampled_rgb[:, 2]
    avg = (sr + sg + sb) / 3.0
    mx = sampled_rgb.max(axis=1)
    mn = sampled_rgb.min(axis=1)
    sat = np.where(mx > 1e-6, (mx - mn) / np.maximum(mx, 1e-6), 0.0)

    pal_idx_per_comp = np.zeros(n_comp, dtype=np.int32)  # 0=body default
    is_dark  = avg < 0.40
    is_cloud = (avg > 0.85) & (sat < 0.10)
    is_stem  = (sr > sg + 0.10) & (sg > sb + 0.05) & (sr < 0.78) & (sr > 0.30) & (sat > 0.30)
    pal_idx_per_comp[is_stem]  = 3
    pal_idx_per_comp[is_cloud] = 1
    pal_idx_per_comp[is_dark]  = 2
    comp_color = palette[pal_idx_per_comp]

    # Stats: how many components per palette
    counts = np.bincount(pal_idx_per_comp, minlength=4)
    L("component_palette_counts", {{palette_names[i]: int(counts[i]) for i in range(4)}})

    # 6. Per-vertex colors = its component's color
    vert_color = comp_color[component]  # (n_verts, 3)

    # Add Color Attribute (POINT)
    for ca in list(me.color_attributes):
        me.color_attributes.remove(ca)
    attr = me.color_attributes.new(name="VCol", type="FLOAT_COLOR", domain="POINT")
    flat = np.concatenate([vert_color, np.ones((n_verts,1), dtype=np.float32)], axis=1).reshape(-1)
    attr.data.foreach_set("color", flat)
    me.update()

    # 7. Material
    while len(me.uv_layers) > 0:
        me.uv_layers.remove(me.uv_layers[0])
    mat = bpy.data.materials.new("RegionMat")
    mat.use_nodes = True
    nt = mat.node_tree
    for n_ in list(nt.nodes):
        nt.nodes.remove(n_)
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Roughness"].default_value = 0.55
    vc = nt.nodes.new("ShaderNodeVertexColor")
    vc.layer_name = "VCol"
    nt.links.new(vc.outputs["Color"], bsdf.inputs["Base Color"])
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    me.materials.clear()
    me.materials.append(mat)

    # 8. Export GLB
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.export_scene.gltf(
        filepath=OUT_GLB,
        use_selection=True,
        export_format="GLB",
        export_apply=False,
    )
    L("EXPORTED", OUT_GLB)

    # 9. Render proof
    y_min, y_max = float(co_w[:,1].min()), float(co_w[:,1].max())
    extent_xz = max(x_rng, z_rng)
    extent_all = max(extent_xz, y_max - y_min)
    center = Vector(((x_min+x_max)/2, (y_min+y_max)/2, (z_min+z_max)/2))

    cam_data = bpy.data.cameras.new("FrontCam")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = extent_xz * 1.15
    cam = bpy.data.objects.new("FrontCam", cam_data)
    bpy.context.scene.collection.objects.link(cam)
    cam.location = center + Vector((0, -extent_all*2.0, 0))
    cam.rotation_euler = (math.radians(90), 0, 0)
    bpy.context.scene.camera = cam

    sun_data = bpy.data.lights.new("Sun", type="SUN")
    sun_data.energy = 3.0
    sun = bpy.data.objects.new("Sun", sun_data)
    sun.location = center + Vector((extent_all, -extent_all, extent_all))
    sun.rotation_euler = (math.radians(50), math.radians(20), math.radians(-30))
    bpy.context.scene.collection.objects.link(sun)

    sc = bpy.context.scene
    world = sc.world or bpy.data.worlds.new("World")
    sc.world = world
    world.use_nodes = True
    wnt = world.node_tree
    for n_ in list(wnt.nodes): wnt.nodes.remove(n_)
    wo = wnt.nodes.new("ShaderNodeOutputWorld")
    wb = wnt.nodes.new("ShaderNodeBackground")
    wb.inputs["Color"].default_value = (0.95,0.95,0.95,1)
    wb.inputs["Strength"].default_value = 0.5
    wnt.links.new(wb.outputs[0], wo.inputs[0])

    sc.render.engine = "CYCLES"
    sc.cycles.samples = 32
    sc.render.resolution_x = 1000
    sc.render.resolution_y = 1000
    sc.render.image_settings.file_format = "PNG"
    sc.render.filepath = OUT_PNG

    bpy.ops.render.render(write_still=True)
    L("RENDERED", OUT_PNG)

except Exception as e:
    print("ERROR", repr(e))
    print(traceback.format_exc())
'''.format(GLB=GLB, IMG=IMG, OUT_GLB=OUT_GLB, OUT_PNG=OUT_PNG)


s = socket.socket(); s.connect(("127.0.0.1", 9876)); s.settimeout(600)
s.sendall(json.dumps({"type":"execute_code","params":{"code":CODE}}).encode())
buf = b""
while True:
    chunk = s.recv(65536)
    if not chunk: break
    buf += chunk
    try:
        resp = json.loads(buf.decode())
        print(json.dumps(resp, indent=2, ensure_ascii=False))
        sys.exit(0 if resp.get("status") == "success" else 1)
    except json.JSONDecodeError:
        continue
print(buf.decode(errors="replace"))
