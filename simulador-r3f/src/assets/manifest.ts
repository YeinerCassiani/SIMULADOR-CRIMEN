// generado por fetch-assets.mjs — no editar a mano.
// Regenerar: node scripts/fetch-assets.mjs (idempotente; --force rehace todo).
// Fuente: Poly Haven (https://polyhaven.com), licencia CC0. Créditos en ASSET_CREDITS.md.

export type AssetLicense = 'CC0';

interface AssetBase {
  id: string;
  title: string;
  license: AssetLicense;
  /** Página del asset en polyhaven.com. */
  source: string;
  authors: readonly string[];
}

export interface ModelAsset extends AssetBase {
  /** Ruta pública servida por Vite (public/). */
  url: string;
  bytes: number;
  group: 'interior' | 'exterior' | 'forensic';
  /** Bounding box del .glb en metros, Y arriba (unidades reales de Poly Haven). */
  bbox: { min: readonly number[]; max: readonly number[]; size: readonly number[] };
  /** Escala sugerida para llevarlo a metros de la escena (Poly Haven ya exporta en metros). */
  scale: number;
  /** true si las texturas se redujeron a 512 px. */
  resized: boolean;
}

export interface TextureMap {
  url: string;
  bytes: number;
  /** srgb solo para albedo; normal y arm son datos lineales. */
  colorSpace: 'srgb' | 'linear';
}

export interface TextureAsset extends AssetBase {
  role: string;
  /** diff: albedo. nor_gl: normal OpenGL (Y+). arm: R oclusión, G rugosidad, B metalicidad. */
  maps: { diff: TextureMap; nor_gl: TextureMap; arm: TextureMap };
}

export interface HdriAsset extends AssetBase {
  role: string;
  url: string;
  bytes: number;
}

export const MODELS = {
  "Sofa_01": {
    "id": "Sofa_01",
    "title": "Sofa 01",
    "authors": [
      "Kirill Sannikov"
    ],
    "license": "CC0",
    "source": "https://polyhaven.com/a/Sofa_01",
    "url": "/assets/models/Sofa_01.glb",
    "bytes": 279160,
    "group": "interior",
    "bbox": {
      "min": [
        -0.778,
        -0.001,
        -0.361
      ],
      "max": [
        0.793,
        0.796,
        0.297
      ],
      "size": [
        1.571,
        0.797,
        0.658
      ]
    },
    "scale": 1,
    "resized": false
  },
  "sofa_02": {
    "id": "sofa_02",
    "title": "Sofa 02",
    "authors": [
      "Kirill Sannikov"
    ],
    "license": "CC0",
    "source": "https://polyhaven.com/a/sofa_02",
    "url": "/assets/models/sofa_02.glb",
    "bytes": 222296,
    "group": "interior",
    "bbox": {
      "min": [
        -0.903,
        0,
        -0.478
      ],
      "max": [
        0.904,
        0.71,
        0.34
      ],
      "size": [
        1.807,
        0.709,
        0.818
      ]
    },
    "scale": 1,
    "resized": false
  },
  "ArmChair_01": {
    "id": "ArmChair_01",
    "title": "Arm Chair 01",
    "authors": [
      "Kirill Sannikov"
    ],
    "license": "CC0",
    "source": "https://polyhaven.com/a/ArmChair_01",
    "url": "/assets/models/ArmChair_01.glb",
    "bytes": 525400,
    "group": "interior",
    "bbox": {
      "min": [
        -0.424,
        0,
        -0.417
      ],
      "max": [
        0.424,
        1.065,
        0.348
      ],
      "size": [
        0.848,
        1.065,
        0.766
      ]
    },
    "scale": 1,
    "resized": false
  },
  "modern_coffee_table_01": {
    "id": "modern_coffee_table_01",
    "title": "Modern Coffee Table 01",
    "authors": [
      "Amin"
    ],
    "license": "CC0",
    "source": "https://polyhaven.com/a/modern_coffee_table_01",
    "url": "/assets/models/modern_coffee_table_01.glb",
    "bytes": 286080,
    "group": "interior",
    "bbox": {
      "min": [
        -0.3,
        0,
        -0.601
      ],
      "max": [
        0.3,
        0.39,
        0.601
      ],
      "size": [
        0.6,
        0.39,
        1.202
      ]
    },
    "scale": 1,
    "resized": false
  },
  "side_table_01": {
    "id": "side_table_01",
    "title": "Side Table 01",
    "authors": [
      "James Ray Cock"
    ],
    "license": "CC0",
    "source": "https://polyhaven.com/a/side_table_01",
    "url": "/assets/models/side_table_01.glb",
    "bytes": 278452,
    "group": "interior",
    "bbox": {
      "min": [
        -0.275,
        -0.002,
        -0.225
      ],
      "max": [
        0.275,
        0.548,
        0.225
      ],
      "size": [
        0.55,
        0.551,
        0.45
      ]
    },
    "scale": 1,
    "resized": false
  },
  "dining_table": {
    "id": "dining_table",
    "title": "Dining Table",
    "authors": [
      "Aron Łyczek"
    ],
    "license": "CC0",
    "source": "https://polyhaven.com/a/dining_table",
    "url": "/assets/models/dining_table.glb",
    "bytes": 391556,
    "group": "interior",
    "bbox": {
      "min": [
        -1.133,
        -0.004,
        -0.678
      ],
      "max": [
        1.123,
        0.873,
        0.712
      ],
      "size": [
        2.256,
        0.877,
        1.39
      ]
    },
    "scale": 1,
    "resized": false
  },
  "dining_chair_02": {
    "id": "dining_chair_02",
    "title": "Dining Chair 02",
    "authors": [
      "James Ray Cock"
    ],
    "license": "CC0",
    "source": "https://polyhaven.com/a/dining_chair_02",
    "url": "/assets/models/dining_chair_02.glb",
    "bytes": 696924,
    "group": "interior",
    "bbox": {
      "min": [
        -0.217,
        0.001,
        -0.331
      ],
      "max": [
        0.217,
        0.975,
        0.245
      ],
      "size": [
        0.434,
        0.973,
        0.576
      ]
    },
    "scale": 1,
    "resized": false
  },
  "ClassicNightstand_01": {
    "id": "ClassicNightstand_01",
    "title": "Classic Nightstand 01",
    "authors": [
      "Kirill Sannikov"
    ],
    "license": "CC0",
    "source": "https://polyhaven.com/a/ClassicNightstand_01",
    "url": "/assets/models/ClassicNightstand_01.glb",
    "bytes": 210156,
    "group": "interior",
    "bbox": {
      "min": [
        -0.284,
        0,
        -0.212
      ],
      "max": [
        0.284,
        0.7,
        0.212
      ],
      "size": [
        0.568,
        0.7,
        0.424
      ]
    },
    "scale": 1,
    "resized": false
  },
  "drawer_cabinet": {
    "id": "drawer_cabinet",
    "title": "Drawer Cabinet",
    "authors": [
      "Ulan Cabanilla"
    ],
    "license": "CC0",
    "source": "https://polyhaven.com/a/drawer_cabinet",
    "url": "/assets/models/drawer_cabinet.glb",
    "bytes": 935992,
    "group": "interior",
    "bbox": {
      "min": [
        -0.571,
        0,
        -0.248
      ],
      "max": [
        0.571,
        1.881,
        0.24
      ],
      "size": [
        1.141,
        1.881,
        0.488
      ]
    },
    "scale": 1,
    "resized": false
  },
  "modern_wooden_cabinet": {
    "id": "modern_wooden_cabinet",
    "title": "Modern Wooden Cabinet",
    "authors": [
      "Patrik Pangerl"
    ],
    "license": "CC0",
    "source": "https://polyhaven.com/a/modern_wooden_cabinet",
    "url": "/assets/models/modern_wooden_cabinet.glb",
    "bytes": 1353184,
    "group": "interior",
    "bbox": {
      "min": [
        -1.22,
        0,
        -0.27
      ],
      "max": [
        1.22,
        0.68,
        0.25
      ],
      "size": [
        2.44,
        0.68,
        0.52
      ]
    },
    "scale": 1,
    "resized": false
  },
  "modern_ceiling_lamp_01": {
    "id": "modern_ceiling_lamp_01",
    "title": "Modern Ceiling Lamp 01",
    "authors": [
      "James Ray Cock"
    ],
    "license": "CC0",
    "source": "https://polyhaven.com/a/modern_ceiling_lamp_01",
    "url": "/assets/models/modern_ceiling_lamp_01.glb",
    "bytes": 266148,
    "group": "interior",
    "bbox": {
      "min": [
        -0.216,
        0.221,
        -0.214
      ],
      "max": [
        0.216,
        1.173,
        0.217
      ],
      "size": [
        0.432,
        0.952,
        0.432
      ]
    },
    "scale": 1,
    "resized": false
  },
  "Television_01": {
    "id": "Television_01",
    "title": "Television 01",
    "authors": [
      "Gabriel Radić"
    ],
    "license": "CC0",
    "source": "https://polyhaven.com/a/Television_01",
    "url": "/assets/models/Television_01.glb",
    "bytes": 286628,
    "group": "interior",
    "bbox": {
      "min": [
        -0.3,
        0,
        -0.258
      ],
      "max": [
        0.3,
        0.457,
        0.212
      ],
      "size": [
        0.6,
        0.457,
        0.471
      ]
    },
    "scale": 1,
    "resized": false
  },
  "hanging_picture_frame_01": {
    "id": "hanging_picture_frame_01",
    "title": "Hanging Picture Frame 01",
    "authors": [
      "James Ray Cock"
    ],
    "license": "CC0",
    "source": "https://polyhaven.com/a/hanging_picture_frame_01",
    "url": "/assets/models/hanging_picture_frame_01.glb",
    "bytes": 198876,
    "group": "interior",
    "bbox": {
      "min": [
        -0.297,
        -0.42,
        0
      ],
      "max": [
        0.297,
        0.42,
        0.016
      ],
      "size": [
        0.594,
        0.841,
        0.016
      ]
    },
    "scale": 1,
    "resized": false
  },
  "potted_plant_02": {
    "id": "potted_plant_02",
    "title": "Potted Plant 02",
    "authors": [
      "Rico Cilliers"
    ],
    "license": "CC0",
    "source": "https://polyhaven.com/a/potted_plant_02",
    "url": "/assets/models/potted_plant_02.glb",
    "bytes": 2226276,
    "group": "interior",
    "bbox": {
      "min": [
        -0.397,
        0,
        -0.42
      ],
      "max": [
        0.304,
        0.841,
        0.237
      ],
      "size": [
        0.701,
        0.841,
        0.657
      ]
    },
    "scale": 1,
    "resized": false
  },
  "electric_stove": {
    "id": "electric_stove",
    "title": "Electric Stove",
    "authors": [
      "Kuutti Siitonen"
    ],
    "license": "CC0",
    "source": "https://polyhaven.com/a/electric_stove",
    "url": "/assets/models/electric_stove.glb",
    "bytes": 704248,
    "group": "interior",
    "bbox": {
      "min": [
        -0.251,
        0,
        -0.3
      ],
      "max": [
        0.251,
        0.859,
        0.348
      ],
      "size": [
        0.503,
        0.859,
        0.648
      ]
    },
    "scale": 1,
    "resized": false
  },
  "GothicBed_01": {
    "id": "GothicBed_01",
    "title": "Gothic Bed 01",
    "authors": [
      "Kirill Sannikov"
    ],
    "license": "CC0",
    "source": "https://polyhaven.com/a/GothicBed_01",
    "url": "/assets/models/GothicBed_01.glb",
    "bytes": 894912,
    "group": "interior",
    "bbox": {
      "min": [
        -0.711,
        0,
        -1.053
      ],
      "max": [
        0.782,
        1.534,
        0.987
      ],
      "size": [
        1.494,
        1.534,
        2.04
      ]
    },
    "scale": 1,
    "resized": false
  },
  "throw_pillows_01": {
    "id": "throw_pillows_01",
    "title": "Throw Pillows 01",
    "authors": [
      "Serhii Khromov"
    ],
    "license": "CC0",
    "source": "https://polyhaven.com/a/throw_pillows_01",
    "url": "/assets/models/throw_pillows_01.glb",
    "bytes": 989788,
    "group": "interior",
    "bbox": {
      "min": [
        -0.464,
        -0.002,
        -0.176
      ],
      "max": [
        0.477,
        0.448,
        0.276
      ],
      "size": [
        0.94,
        0.45,
        0.452
      ]
    },
    "scale": 1,
    "resized": false
  },
  "street_lamp_01": {
    "id": "street_lamp_01",
    "title": "Street Lamp 01",
    "authors": [
      "Josh Dean"
    ],
    "license": "CC0",
    "source": "https://polyhaven.com/a/street_lamp_01",
    "url": "/assets/models/street_lamp_01.glb",
    "bytes": 930728,
    "group": "exterior",
    "bbox": {
      "min": [
        -0.352,
        0,
        -0.193
      ],
      "max": [
        0.352,
        3.871,
        0.193
      ],
      "size": [
        0.704,
        3.871,
        0.386
      ]
    },
    "scale": 1,
    "resized": false
  },
  "concrete_road_barrier": {
    "id": "concrete_road_barrier",
    "title": "Concrete Road Barrier",
    "authors": [
      "Amal Kumar"
    ],
    "license": "CC0",
    "source": "https://polyhaven.com/a/concrete_road_barrier",
    "url": "/assets/models/concrete_road_barrier.glb",
    "bytes": 1768932,
    "group": "exterior",
    "bbox": {
      "min": [
        -0.775,
        -0.008,
        -0.295
      ],
      "max": [
        0.771,
        0.823,
        0.344
      ],
      "size": [
        1.545,
        0.831,
        0.639
      ]
    },
    "scale": 1,
    "resized": false
  },
  "covered_car": {
    "id": "covered_car",
    "title": "Covered Car",
    "authors": [
      "MP"
    ],
    "license": "CC0",
    "source": "https://polyhaven.com/a/covered_car",
    "url": "/assets/models/covered_car.glb",
    "bytes": 617168,
    "group": "exterior",
    "bbox": {
      "min": [
        -0.847,
        0,
        -2.166
      ],
      "max": [
        0.942,
        1.411,
        2.214
      ],
      "size": [
        1.789,
        1.411,
        4.38
      ]
    },
    "scale": 1,
    "resized": false
  },
  "metal_trash_can": {
    "id": "metal_trash_can",
    "title": "Metal Trash Can",
    "authors": [
      "GurJas Studios"
    ],
    "license": "CC0",
    "source": "https://polyhaven.com/a/metal_trash_can",
    "url": "/assets/models/metal_trash_can.glb",
    "bytes": 1138952,
    "group": "exterior",
    "bbox": {
      "min": [
        -0.953,
        0,
        -0.278
      ],
      "max": [
        0.825,
        0.906,
        0.278
      ],
      "size": [
        1.778,
        0.906,
        0.556
      ]
    },
    "scale": 1,
    "resized": false
  },
  "fire_hydrant": {
    "id": "fire_hydrant",
    "title": "Fire Hydrant",
    "authors": [
      "Gonçalo Felício"
    ],
    "license": "CC0",
    "source": "https://polyhaven.com/a/fire_hydrant",
    "url": "/assets/models/fire_hydrant.glb",
    "bytes": 2411600,
    "group": "exterior",
    "bbox": {
      "min": [
        -0.442,
        0,
        -0.127
      ],
      "max": [
        0.433,
        0.799,
        0.191
      ],
      "size": [
        0.875,
        0.799,
        0.318
      ]
    },
    "scale": 1,
    "resized": false
  },
  "painted_wooden_bench": {
    "id": "painted_wooden_bench",
    "title": "Painted Wooden Bench",
    "authors": [
      "Kirill Sannikov"
    ],
    "license": "CC0",
    "source": "https://polyhaven.com/a/painted_wooden_bench",
    "url": "/assets/models/painted_wooden_bench.glb",
    "bytes": 276284,
    "group": "exterior",
    "bbox": {
      "min": [
        -0.576,
        0,
        -0.254
      ],
      "max": [
        0.589,
        0.889,
        0.243
      ],
      "size": [
        1.165,
        0.889,
        0.497
      ]
    },
    "scale": 1,
    "resized": false
  },
  "trashbag": {
    "id": "trashbag",
    "title": "Trashbag",
    "authors": [
      "Benny Weimer"
    ],
    "license": "CC0",
    "source": "https://polyhaven.com/a/trashbag",
    "url": "/assets/models/trashbag.glb",
    "bytes": 335004,
    "group": "exterior",
    "bbox": {
      "min": [
        -0.26,
        -0.001,
        -0.24
      ],
      "max": [
        0.268,
        0.574,
        0.223
      ],
      "size": [
        0.528,
        0.575,
        0.463
      ]
    },
    "scale": 1,
    "resized": false
  },
  "utility_box_02": {
    "id": "utility_box_02",
    "title": "Utility Box 02",
    "authors": [
      "James Ray Cock"
    ],
    "license": "CC0",
    "source": "https://polyhaven.com/a/utility_box_02",
    "url": "/assets/models/utility_box_02.glb",
    "bytes": 392416,
    "group": "exterior",
    "bbox": {
      "min": [
        -0.46,
        0,
        -0.21
      ],
      "max": [
        0.46,
        1.12,
        0.222
      ],
      "size": [
        0.92,
        1.12,
        0.432
      ]
    },
    "scale": 1,
    "resized": false
  },
  "rollershutter_door": {
    "id": "rollershutter_door",
    "title": "Rollershutter Door",
    "authors": [
      "MP"
    ],
    "license": "CC0",
    "source": "https://polyhaven.com/a/rollershutter_door",
    "url": "/assets/models/rollershutter_door.glb",
    "bytes": 315652,
    "group": "exterior",
    "bbox": {
      "min": [
        -0.54,
        0,
        -0.001
      ],
      "max": [
        2.54,
        2.4,
        0.299
      ],
      "size": [
        3.08,
        2.4,
        0.3
      ]
    },
    "scale": 1,
    "resized": false
  },
  "clipboard": {
    "id": "clipboard",
    "title": "Clipboard",
    "authors": [
      "ProgrammerOnCoffee"
    ],
    "license": "CC0",
    "source": "https://polyhaven.com/a/clipboard",
    "url": "/assets/models/clipboard.glb",
    "bytes": 237184,
    "group": "forensic",
    "bbox": {
      "min": [
        -0.114,
        -0.003,
        -0.178
      ],
      "max": [
        0.114,
        0.039,
        0.159
      ],
      "size": [
        0.229,
        0.042,
        0.337
      ]
    },
    "scale": 1,
    "resized": true
  },
  "cardboard_box_01": {
    "id": "cardboard_box_01",
    "title": "Cardboard Box 01",
    "authors": [
      "Rahul Chaudhary"
    ],
    "license": "CC0",
    "source": "https://polyhaven.com/a/cardboard_box_01",
    "url": "/assets/models/cardboard_box_01.glb",
    "bytes": 607260,
    "group": "forensic",
    "bbox": {
      "min": [
        -0.193,
        -0.007,
        -0.225
      ],
      "max": [
        0.195,
        0.335,
        0.291
      ],
      "size": [
        0.387,
        0.342,
        0.516
      ]
    },
    "scale": 1,
    "resized": false
  },
  "cigarette_pack": {
    "id": "cigarette_pack",
    "title": "Cigarette Pack",
    "authors": [
      "Ulrich Büch"
    ],
    "license": "CC0",
    "source": "https://polyhaven.com/a/cigarette_pack",
    "url": "/assets/models/cigarette_pack.glb",
    "bytes": 366716,
    "group": "forensic",
    "bbox": {
      "min": [
        -0.028,
        0,
        -0.006
      ],
      "max": [
        0.028,
        0.102,
        0.023
      ],
      "size": [
        0.056,
        0.103,
        0.029
      ]
    },
    "scale": 1,
    "resized": true
  },
  "fish_knife": {
    "id": "fish_knife",
    "title": "Fish Knife",
    "authors": [
      "Mateusz Sadek"
    ],
    "license": "CC0",
    "source": "https://polyhaven.com/a/fish_knife",
    "url": "/assets/models/fish_knife.glb",
    "bytes": 213948,
    "group": "forensic",
    "bbox": {
      "min": [
        -0.015,
        -0.11,
        -0.008
      ],
      "max": [
        0.015,
        0.105,
        0.008
      ],
      "size": [
        0.029,
        0.216,
        0.016
      ]
    },
    "scale": 1,
    "resized": true
  },
  "service_pistol": {
    "id": "service_pistol",
    "title": "Service Pistol",
    "authors": [
      "Mateusz Sadek"
    ],
    "license": "CC0",
    "source": "https://polyhaven.com/a/service_pistol",
    "url": "/assets/models/service_pistol.glb",
    "bytes": 1180856,
    "group": "forensic",
    "bbox": {
      "min": [
        -0.128,
        -0.052,
        -0.016
      ],
      "max": [
        0.174,
        0.229,
        0.016
      ],
      "size": [
        0.302,
        0.281,
        0.032
      ]
    },
    "scale": 1,
    "resized": true
  },
  "baseball_bat": {
    "id": "baseball_bat",
    "title": "Baseball Bat",
    "authors": [
      "Enrique Martín"
    ],
    "license": "CC0",
    "source": "https://polyhaven.com/a/baseball_bat",
    "url": "/assets/models/baseball_bat.glb",
    "bytes": 129680,
    "group": "forensic",
    "bbox": {
      "min": [
        -0.032,
        -0.254,
        -0.032
      ],
      "max": [
        0.032,
        0.659,
        0.031
      ],
      "size": [
        0.064,
        0.913,
        0.064
      ]
    },
    "scale": 1,
    "resized": true
  },
  "magnifying_glass_01": {
    "id": "magnifying_glass_01",
    "title": "Magnifying Glass 01",
    "authors": [
      "Nazar Borodavka"
    ],
    "license": "CC0",
    "source": "https://polyhaven.com/a/magnifying_glass_01",
    "url": "/assets/models/magnifying_glass_01.glb",
    "bytes": 215896,
    "group": "forensic",
    "bbox": {
      "min": [
        -0.066,
        0,
        -0.013
      ],
      "max": [
        0.066,
        0.272,
        0.013
      ],
      "size": [
        0.132,
        0.272,
        0.027
      ]
    },
    "scale": 1,
    "resized": true
  }
} as const satisfies Record<string, ModelAsset>;

export const TEXTURES = {
  "wood_floor": {
    "id": "wood_floor",
    "title": "Wood Floor",
    "authors": [
      "Dimitrios Savva"
    ],
    "license": "CC0",
    "source": "https://polyhaven.com/a/wood_floor",
    "role": "piso-madera-interior",
    "maps": {
      "diff": {
        "url": "/assets/textures/wood_floor/wood_floor_diff_1k.webp",
        "bytes": 106642,
        "colorSpace": "srgb"
      },
      "nor_gl": {
        "url": "/assets/textures/wood_floor/wood_floor_nor_gl_1k.webp",
        "bytes": 4426,
        "colorSpace": "linear"
      },
      "arm": {
        "url": "/assets/textures/wood_floor/wood_floor_arm_1k.webp",
        "bytes": 16850,
        "colorSpace": "linear"
      }
    }
  },
  "terracotta_floor_tiles": {
    "id": "terracotta_floor_tiles",
    "title": "Terracotta Floor Tiles",
    "authors": [
      "Dimitrios Savva"
    ],
    "license": "CC0",
    "source": "https://polyhaven.com/a/terracotta_floor_tiles",
    "role": "piso-baldosa-vivienda",
    "maps": {
      "diff": {
        "url": "/assets/textures/terracotta_floor_tiles/terracotta_floor_tiles_diff_1k.webp",
        "bytes": 39036,
        "colorSpace": "srgb"
      },
      "nor_gl": {
        "url": "/assets/textures/terracotta_floor_tiles/terracotta_floor_tiles_nor_gl_1k.webp",
        "bytes": 26340,
        "colorSpace": "linear"
      },
      "arm": {
        "url": "/assets/textures/terracotta_floor_tiles/terracotta_floor_tiles_arm_1k.webp",
        "bytes": 48760,
        "colorSpace": "linear"
      }
    }
  },
  "white_plaster_02": {
    "id": "white_plaster_02",
    "title": "White Plaster 02",
    "authors": [
      "Rob Tuytel"
    ],
    "license": "CC0",
    "source": "https://polyhaven.com/a/white_plaster_02",
    "role": "muro-yeso",
    "maps": {
      "diff": {
        "url": "/assets/textures/white_plaster_02/white_plaster_02_diff_1k.webp",
        "bytes": 195608,
        "colorSpace": "srgb"
      },
      "nor_gl": {
        "url": "/assets/textures/white_plaster_02/white_plaster_02_nor_gl_1k.webp",
        "bytes": 95258,
        "colorSpace": "linear"
      },
      "arm": {
        "url": "/assets/textures/white_plaster_02/white_plaster_02_arm_1k.webp",
        "bytes": 89618,
        "colorSpace": "linear"
      }
    }
  },
  "dark_wood": {
    "id": "dark_wood",
    "title": "Dark Wood",
    "authors": [
      "Dario Barresi",
      "Dimitrios Savva",
      "Rico Cilliers"
    ],
    "license": "CC0",
    "source": "https://polyhaven.com/a/dark_wood",
    "role": "zocalo-madera",
    "maps": {
      "diff": {
        "url": "/assets/textures/dark_wood/dark_wood_diff_1k.webp",
        "bytes": 104516,
        "colorSpace": "srgb"
      },
      "nor_gl": {
        "url": "/assets/textures/dark_wood/dark_wood_nor_gl_1k.webp",
        "bytes": 5902,
        "colorSpace": "linear"
      },
      "arm": {
        "url": "/assets/textures/dark_wood/dark_wood_arm_1k.webp",
        "bytes": 47314,
        "colorSpace": "linear"
      }
    }
  },
  "asphalt_02": {
    "id": "asphalt_02",
    "title": "Asphalt 02",
    "authors": [
      "Rob Tuytel"
    ],
    "license": "CC0",
    "source": "https://polyhaven.com/a/asphalt_02",
    "role": "asfalto",
    "maps": {
      "diff": {
        "url": "/assets/textures/asphalt_02/asphalt_02_diff_1k.webp",
        "bytes": 364966,
        "colorSpace": "srgb"
      },
      "nor_gl": {
        "url": "/assets/textures/asphalt_02/asphalt_02_nor_gl_1k.webp",
        "bytes": 327196,
        "colorSpace": "linear"
      },
      "arm": {
        "url": "/assets/textures/asphalt_02/asphalt_02_arm_1k.webp",
        "bytes": 211642,
        "colorSpace": "linear"
      }
    }
  },
  "pavement_02": {
    "id": "pavement_02",
    "title": "Pavement 02",
    "authors": [
      "Charlotte Baglioni",
      "Dario Barresi"
    ],
    "license": "CC0",
    "source": "https://polyhaven.com/a/pavement_02",
    "role": "acera-concreto",
    "maps": {
      "diff": {
        "url": "/assets/textures/pavement_02/pavement_02_diff_1k.webp",
        "bytes": 364890,
        "colorSpace": "srgb"
      },
      "nor_gl": {
        "url": "/assets/textures/pavement_02/pavement_02_nor_gl_1k.webp",
        "bytes": 53264,
        "colorSpace": "linear"
      },
      "arm": {
        "url": "/assets/textures/pavement_02/pavement_02_arm_1k.webp",
        "bytes": 100314,
        "colorSpace": "linear"
      }
    }
  },
  "sparse_grass": {
    "id": "sparse_grass",
    "title": "Sparse Grass",
    "authors": [
      "Amal Kumar"
    ],
    "license": "CC0",
    "source": "https://polyhaven.com/a/sparse_grass",
    "role": "pasto",
    "maps": {
      "diff": {
        "url": "/assets/textures/sparse_grass/sparse_grass_diff_1k.webp",
        "bytes": 187620,
        "colorSpace": "srgb"
      },
      "nor_gl": {
        "url": "/assets/textures/sparse_grass/sparse_grass_nor_gl_1k.webp",
        "bytes": 430098,
        "colorSpace": "linear"
      },
      "arm": {
        "url": "/assets/textures/sparse_grass/sparse_grass_arm_1k.webp",
        "bytes": 171440,
        "colorSpace": "linear"
      }
    }
  },
  "forest_ground_05": {
    "id": "forest_ground_05",
    "title": "Forest Ground 05",
    "authors": [
      "Charlotte Baglioni"
    ],
    "license": "CC0",
    "source": "https://polyhaven.com/a/forest_ground_05",
    "role": "tierra",
    "maps": {
      "diff": {
        "url": "/assets/textures/forest_ground_05/forest_ground_05_diff_1k.webp",
        "bytes": 70054,
        "colorSpace": "srgb"
      },
      "nor_gl": {
        "url": "/assets/textures/forest_ground_05/forest_ground_05_nor_gl_1k.webp",
        "bytes": 289806,
        "colorSpace": "linear"
      },
      "arm": {
        "url": "/assets/textures/forest_ground_05/forest_ground_05_arm_1k.webp",
        "bytes": 96078,
        "colorSpace": "linear"
      }
    }
  },
  "red_brick": {
    "id": "red_brick",
    "title": "Red Brick",
    "authors": [
      "Rob Tuytel"
    ],
    "license": "CC0",
    "source": "https://polyhaven.com/a/red_brick",
    "role": "ladrillo-exterior",
    "maps": {
      "diff": {
        "url": "/assets/textures/red_brick/red_brick_diff_1k.webp",
        "bytes": 94274,
        "colorSpace": "srgb"
      },
      "nor_gl": {
        "url": "/assets/textures/red_brick/red_brick_nor_gl_1k.webp",
        "bytes": 221806,
        "colorSpace": "linear"
      },
      "arm": {
        "url": "/assets/textures/red_brick/red_brick_arm_1k.webp",
        "bytes": 61446,
        "colorSpace": "linear"
      }
    }
  }
} as const satisfies Record<string, TextureAsset>;

export const HDRIS = {
  "street_lamp": {
    "id": "street_lamp",
    "title": "Street Lamp",
    "authors": [
      "Greg Zaal"
    ],
    "license": "CC0",
    "source": "https://polyhaven.com/a/street_lamp",
    "role": "exterior-noche",
    "url": "/assets/hdri/street_lamp_1k.hdr",
    "bytes": 1779341
  },
  "small_empty_room_2": {
    "id": "small_empty_room_2",
    "title": "Small Empty Room 2",
    "authors": [
      "Sergej Majboroda"
    ],
    "license": "CC0",
    "source": "https://polyhaven.com/a/small_empty_room_2",
    "role": "interior-tenue",
    "url": "/assets/hdri/small_empty_room_2_1k.hdr",
    "bytes": 1477109
  }
} as const satisfies Record<string, HdriAsset>;

/** Candidatos descartados por presupuesto (no están en disco). */
export const DISCARDED: readonly { id: string; reason: string }[] = [];

export const ASSET_BUDGET = { modelBytes: 2621440, hdriBytes: 2097152, totalBytes: 47185920 } as const;

/** Suma de bytes de todo lo listado arriba. */
export const TOTAL_BYTES = 28965966;

export type ModelId = keyof typeof MODELS;
export type TextureId = keyof typeof TEXTURES;
export type HdriId = keyof typeof HDRIS;
