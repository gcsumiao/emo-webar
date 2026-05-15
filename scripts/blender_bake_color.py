"""Drive BlenderMCP (port 9876) to bake a front-projected color onto a GLB.

Usage:  python3 scripts/blender_bake_color.py
Requires: Blender open with the BlenderMCP addon connected on 127.0.0.1:9876.
"""

import json
import socket
import sys

HOST, PORT = "127.0.0.1", 9876

GLB = "/Users/sumiaoc/Downloads/emo-checklist/2.AR角色素材/1.3D模型文件-GLB/一毛坐姿.glb"
IMG = "/Users/sumiaoc/Downloads/emo-checklist/2.AR角色素材/2.一毛动画工程文件/emo3D动画黑色背景（png帧序列+MP4）/png/1_0300.png"
OUT = "/Users/sumiaoc/Downloads/emo-checklist/2.AR角色素材/1.3D模型文件-GLB/一毛坐姿_colored.glb"
BAKED_PNG = "/Users/sumiaoc/Downloads/emo-checklist/2.AR角色素材/1.3D模型文件-GLB/一毛坐姿_baked.png"
TEX = 2048

BLENDER_CODE = r'''
import bpy, math, os, sys, traceback

GLB = {GLB!r}
IMG = {IMG!r}
OUT = {OUT!r}
BAKED_PNG = {BAKED_PNG!r}
TEX = {TEX}

log = []
def L(*a):
    s = " ".join(str(x) for x in a)
    log.append(s)
    print(s)

try:
    # 1. Reset mesh objects
    for o in list(bpy.data.objects):
        if o.type == "MESH":
            bpy.data.objects.remove(o, do_unlink=True)

    # 2. Import GLB
    bpy.ops.import_scene.gltf(filepath=GLB)
    mesh_objs = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    L("imported_meshes", len(mesh_objs))

    bpy.ops.object.select_all(action="DESELECT")
    for o in mesh_objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = mesh_objs[0]
    if len(mesh_objs) > 1:
        bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    me = obj.data
    L("joined_obj", obj.name, "verts", len(me.vertices), "loops", len(me.loops))

    # 3. Build BakeUV (cylindrical, manual) and ProjUV (front XZ, manual).
    # Cylindrical avoids fragmentation from the mesh's disconnected faces.
    while len(me.uv_layers) > 0:
        me.uv_layers.remove(me.uv_layers[0])
    bake_uv = me.uv_layers.new(name="BakeUV")
    proj_uv = me.uv_layers.new(name="ProjUV")

    mw = obj.matrix_world
    verts_w = [mw @ v.co for v in me.vertices]
    xs = [p.x for p in verts_w]; ys = [p.y for p in verts_w]; zs = [p.z for p in verts_w]
    x_min, x_max = min(xs), max(xs)
    y_min, y_max = min(ys), max(ys)
    z_min, z_max = min(zs), max(zs)
    x_rng = max(x_max - x_min, 1e-6)
    z_rng = max(z_max - z_min, 1e-6)
    cx = (x_min + x_max) / 2
    cy = (y_min + y_max) / 2
    L("bbox_x", round(x_min,3), round(x_max,3),
      "bbox_y", round(y_min,3), round(y_max,3),
      "bbox_z", round(z_min,3), round(z_max,3))

    # Cylindrical BakeUV: u = atan2(y-cy, x-cx)/2π + 0.5, v = (z-z_min)/z_rng.
    # Seam handling: per polygon, if u-spread > 0.5, lift small u by 1 then renormalize all u
    # at the end so the layout fits within [0,1] horizontally.
    bake_data = bake_uv.data
    raw_us_per_loop = [0.0] * len(me.loops)
    for poly in me.polygons:
        loop_idx = list(poly.loop_indices)
        us = []
        for li in loop_idx:
            p = verts_w[me.loops[li].vertex_index]
            us.append(math.atan2(p.y - cy, p.x - cx) / (2 * math.pi) + 0.5)
        if (max(us) - min(us)) > 0.5:
            us = [u + 1.0 if u < 0.5 else u for u in us]
        for li, u in zip(loop_idx, us):
            raw_us_per_loop[li] = u
    u_lo = min(raw_us_per_loop); u_hi = max(raw_us_per_loop)
    u_span = max(u_hi - u_lo, 1e-6)
    L("bake_u_range", round(u_lo,3), round(u_hi,3))
    for li in range(len(me.loops)):
        u = (raw_us_per_loop[li] - u_lo) / u_span
        p = verts_w[me.loops[li].vertex_index]
        v = (p.z - z_min) / z_rng
        bake_data[li].uv = (u, v)

    # 5. Load image, detect pink-character bbox + average color.
    # The reference frame has a sky-blue gradient background, character is pink.
    img = bpy.data.images.load(IMG, check_existing=True)
    W, H = img.size[0], img.size[1]
    L("img_size", W, H)
    try:
        import numpy as np
        arr = np.array(img.pixels[:], dtype=np.float32).reshape(H, W, 4)
        r = arr[..., 0]; g = arr[..., 1]; b = arr[..., 2]
        mask = (r > g + 0.04) & (r > b + 0.04) & (r > 0.3)
        ys, xs = np.where(mask)
        if xs.size > 0:
            px_x_min, px_x_max = int(xs.min()), int(xs.max())
            px_y_min, px_y_max = int(ys.min()), int(ys.max())
            avg = (float(r[mask].mean()), float(g[mask].mean()), float(b[mask].mean()))
        else:
            px_x_min, px_x_max = 0, W - 1
            px_y_min, px_y_max = 0, H - 1
            avg = (1.0, 0.7, 0.8)
        pink_count = int(xs.size)
    except Exception as ex:
        L("numpy_unavailable", repr(ex))
        px_x_min, px_x_max = 0, W - 1
        px_y_min, px_y_max = 0, H - 1
        avg = (1.0, 0.7, 0.8)
        pink_count = 0

    u_min = px_x_min / W
    u_max = (px_x_max + 1) / W
    v_min = px_y_min / H
    v_max = (px_y_max + 1) / H
    u_rng = max(u_max - u_min, 1e-6)
    v_rng = max(v_max - v_min, 1e-6)
    L("pink_bbox_px", px_x_min, px_y_min, px_x_max, px_y_max, "count", pink_count)
    L("avg_rgb", round(avg[0],3), round(avg[1],3), round(avg[2],3))

    for poly in me.polygons:
        for li in poly.loop_indices:
            vi = me.loops[li].vertex_index
            p = verts_w[vi]
            u = u_min + (p.x - x_min) / x_rng * u_rng
            v = v_min + (p.z - z_min) / z_rng * v_rng
            proj_uv.data[li].uv = (u, v)

    # Re-resolve active UV after creating ProjUV (the new layer can shift active state)
    me.uv_layers.active_index = me.uv_layers.find("BakeUV")
    me.uv_layers["BakeUV"].active_render = True
    L("uv_layers", [(u.name, u.active_render) for u in me.uv_layers], "active_index", me.uv_layers.active_index)

    # 6. Build projection material
    mat = bpy.data.materials.new("ProjMat")
    mat.use_nodes = True
    nt = mat.node_tree
    for n_ in list(nt.nodes):
        nt.nodes.remove(n_)
    n_out = nt.nodes.new("ShaderNodeOutputMaterial")
    n_bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    n_uv = nt.nodes.new("ShaderNodeUVMap"); n_uv.uv_map = "ProjUV"
    n_tex = nt.nodes.new("ShaderNodeTexImage"); n_tex.image = img; n_tex.extension = "CLIP"
    n_rgb = nt.nodes.new("ShaderNodeRGB")
    n_rgb.outputs[0].default_value = (avg[0], avg[1], avg[2], 1.0)

    # non-black factor
    n_sep = nt.nodes.new("ShaderNodeSeparateColor")
    n_addRG = nt.nodes.new("ShaderNodeMath"); n_addRG.operation = "ADD"
    n_addRGB = nt.nodes.new("ShaderNodeMath"); n_addRGB.operation = "ADD"
    n_gt = nt.nodes.new("ShaderNodeMath"); n_gt.operation = "GREATER_THAN"; n_gt.inputs[1].default_value = 0.05

    # front-facing factor (normal.y in world space)
    n_geo = nt.nodes.new("ShaderNodeNewGeometry")
    n_sepN = nt.nodes.new("ShaderNodeSeparateXYZ")
    n_mr = nt.nodes.new("ShaderNodeMapRange")
    n_mr.inputs["From Min"].default_value = -0.2
    n_mr.inputs["From Max"].default_value =  0.2

    # combine factors: fac = front_facing * non_black
    n_mulF = nt.nodes.new("ShaderNodeMath"); n_mulF.operation = "MULTIPLY"

    # mix
    n_mix = nt.nodes.new("ShaderNodeMixRGB")
    n_mix.inputs["Color1"].default_value = (avg[0], avg[1], avg[2], 1.0)  # fac=0 -> avg

    nt.links.new(n_uv.outputs["UV"], n_tex.inputs["Vector"])
    nt.links.new(n_tex.outputs["Color"], n_sep.inputs["Color"])
    nt.links.new(n_sep.outputs[0], n_addRG.inputs[0])
    nt.links.new(n_sep.outputs[1], n_addRG.inputs[1])
    nt.links.new(n_addRG.outputs[0], n_addRGB.inputs[0])
    nt.links.new(n_sep.outputs[2], n_addRGB.inputs[1])
    nt.links.new(n_addRGB.outputs[0], n_gt.inputs[0])

    nt.links.new(n_geo.outputs["Normal"], n_sepN.inputs[0])
    nt.links.new(n_sepN.outputs["Y"], n_mr.inputs["Value"])
    # camera looks toward -Y in front view, so front-facing normals have Y > 0... but
    # actually Blender front view (Numpad 1) looks ALONG -Y, so visible front faces have
    # normal.y NEGATIVE (pointing toward camera at -Y). Flip mapping.
    n_mr.inputs["From Min"].default_value =  0.2
    n_mr.inputs["From Max"].default_value = -0.2

    nt.links.new(n_mr.outputs["Result"], n_mulF.inputs[0])
    nt.links.new(n_gt.outputs[0], n_mulF.inputs[1])
    nt.links.new(n_mulF.outputs[0], n_mix.inputs["Fac"])
    nt.links.new(n_tex.outputs["Color"], n_mix.inputs["Color2"])
    nt.links.new(n_mix.outputs["Color"], n_bsdf.inputs["Base Color"])
    nt.links.new(n_bsdf.outputs["BSDF"], n_out.inputs["Surface"])

    obj.data.materials.clear()
    obj.data.materials.append(mat)

    # 7. Bake target image + node
    if "BakedColor" in bpy.data.images:
        bpy.data.images.remove(bpy.data.images["BakedColor"])
    bake_img = bpy.data.images.new("BakedColor", TEX, TEX, alpha=False)

    n_bake_uv = nt.nodes.new("ShaderNodeUVMap"); n_bake_uv.uv_map = "BakeUV"
    n_bake_tex = nt.nodes.new("ShaderNodeTexImage"); n_bake_tex.image = bake_img
    nt.links.new(n_bake_uv.outputs["UV"], n_bake_tex.inputs["Vector"])

    for nd in nt.nodes:
        nd.select = False
    n_bake_tex.select = True
    nt.nodes.active = n_bake_tex

    # 8. Bake
    bpy.context.scene.render.engine = "CYCLES"
    bpy.context.scene.cycles.samples = 1
    bpy.context.scene.cycles.bake_type = "DIFFUSE"
    bpy.context.scene.render.bake.use_pass_direct = False
    bpy.context.scene.render.bake.use_pass_indirect = False
    bpy.context.scene.render.bake.use_pass_color = True
    bpy.context.scene.render.bake.margin = 16

    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj

    L("baking...")
    bpy.ops.object.bake(type="DIFFUSE")
    L("bake_done")

    # 9. Save baked PNG
    bake_img.filepath_raw = BAKED_PNG
    bake_img.file_format = "PNG"
    bake_img.save()
    L("saved_png", BAKED_PNG)

    # 10. Swap to baked-only material
    mat2 = bpy.data.materials.new("BakedMat")
    mat2.use_nodes = True
    nt2 = mat2.node_tree
    for n_ in list(nt2.nodes):
        nt2.nodes.remove(n_)
    o2 = nt2.nodes.new("ShaderNodeOutputMaterial")
    b2 = nt2.nodes.new("ShaderNodeBsdfPrincipled")
    u2 = nt2.nodes.new("ShaderNodeUVMap"); u2.uv_map = "BakeUV"
    t2 = nt2.nodes.new("ShaderNodeTexImage"); t2.image = bake_img
    nt2.links.new(u2.outputs["UV"], t2.inputs["Vector"])
    nt2.links.new(t2.outputs["Color"], b2.inputs["Base Color"])
    nt2.links.new(b2.outputs["BSDF"], o2.inputs["Surface"])

    obj.data.materials.clear()
    obj.data.materials.append(mat2)

    me.uv_layers.active = me.uv_layers["BakeUV"]
    me.uv_layers["BakeUV"].active_render = True

    # 11. Export GLB
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.export_scene.gltf(
        filepath=OUT,
        use_selection=True,
        export_format="GLB",
        export_image_format="AUTO",
        export_apply=False,
    )
    L("DONE", OUT)

except Exception as e:
    L("ERROR", repr(e))
    L(traceback.format_exc())
'''.format(GLB=GLB, IMG=IMG, OUT=OUT, BAKED_PNG=BAKED_PNG, TEX=TEX)


def send(sock, payload, timeout=600):
    sock.settimeout(timeout)
    sock.sendall(json.dumps(payload).encode("utf-8"))
    buf = b""
    while True:
        chunk = sock.recv(65536)
        if not chunk:
            break
        buf += chunk
        try:
            return json.loads(buf.decode("utf-8"))
        except json.JSONDecodeError:
            continue
    if not buf:
        return {"status": "error", "message": "empty response"}
    return {"status": "error", "message": "incomplete json", "raw": buf.decode("utf-8", "replace")}


def main():
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.connect((HOST, PORT))
    resp = send(s, {"type": "execute_code", "params": {"code": BLENDER_CODE}})
    print(json.dumps(resp, indent=2, ensure_ascii=False))
    if resp.get("status") != "success":
        sys.exit(1)


if __name__ == "__main__":
    main()
