// Lightweight Three.js GLB / glTF 2.0 Loader for Hybrid Character Overrides (Method B)
import * as THREE from './three.module.js';

export class GLTFLoader {
  load(url, onLoad, onProgress, onError) {
    fetch(url)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status} loading ${url}`);
        return res.arrayBuffer();
      })
      .then(buffer => this.parse(buffer, onLoad, onError))
      .catch(err => onError?.(err));
  }

  parse(buffer, onLoad, onError) {
    try {
      const magic = new TextDecoder().decode(new Uint8Array(buffer, 0, 4));
      let json = null;
      let binChunk = null;
      if (magic === 'glTF') {
        const view = new DataView(buffer);
        const totalLen = view.getUint32(8, true);
        let offset = 12;
        while (offset < totalLen) {
          const chunkLen = view.getUint32(offset, true);
          const chunkType = view.getUint32(offset + 4, true);
          offset += 8;
          if (chunkType === 0x4E4F534A) {
            json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, offset, chunkLen)));
          } else if (chunkType === 0x004E4942) {
            binChunk = buffer.slice(offset, offset + chunkLen);
          }
          offset += chunkLen;
        }
      } else {
        json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer)));
      }
      if (!json) throw new Error('Invalid GLB/glTF payload');
      const scene = this._buildScene(json, binChunk);
      onLoad?.({ scene, scenes: [scene], animations: [], parser: { json } });
    } catch (err) {
      onError?.(err);
    }
  }

  _buildScene(json, binChunk) {
    const group = new THREE.Group();
    const COMP_TYPES = {
      5120: Int8Array,
      5121: Uint8Array,
      5122: Int16Array,
      5123: Uint16Array,
      5125: Uint32Array,
      5126: Float32Array
    };
    const TYPE_SIZES = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

    const getAccessorArray = idx => {
      if (idx === undefined || !json.accessors?.[idx] || !binChunk) return null;
      const acc = json.accessors[idx];
      const bv = json.bufferViews?.[acc.bufferView];
      if (!bv) return null;
      const TypedArr = COMP_TYPES[acc.componentType] || Float32Array;
      const itemSize = TYPE_SIZES[acc.type] || 1;
      const byteOffset = (bv.byteOffset || 0) + (acc.byteOffset || 0);
      return {
        array: new TypedArr(binChunk, byteOffset, acc.count * itemSize),
        itemSize
      };
    };

    const materials = (json.materials || []).map(m => {
      const base = m.pbrMetallicRoughness?.baseColorFactor || [0.9, 0.85, 0.8, 1];
      const color = new THREE.Color(base[0], base[1], base[2]);
      return new THREE.MeshStandardMaterial({
        color,
        metalness: m.pbrMetallicRoughness?.metallicFactor ?? 0.1,
        roughness: m.pbrMetallicRoughness?.roughnessFactor ?? 0.65
      });
    });
    const defaultMat = new THREE.MeshStandardMaterial({ color: '#eab58c', roughness: 0.6 });

    for (const meshDef of json.meshes || []) {
      for (const prim of meshDef.primitives || []) {
        const geo = new THREE.BufferGeometry();
        const pos = getAccessorArray(prim.attributes?.POSITION);
        if (!pos) continue;
        geo.setAttribute('position', new THREE.BufferAttribute(pos.array, pos.itemSize));
        const norm = getAccessorArray(prim.attributes?.NORMAL);
        if (norm) geo.setAttribute('normal', new THREE.BufferAttribute(norm.array, norm.itemSize));
        else geo.computeVertexNormals();
        if (prim.indices !== undefined) {
          const idx = getAccessorArray(prim.indices);
          if (idx) geo.setIndex(new THREE.BufferAttribute(idx.array, 1));
        }
        const mat = materials[prim.material] || defaultMat;
        const mesh = new THREE.Mesh(geo, mat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
      }
    }
    return group;
  }
}
