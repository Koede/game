/**
 * Hearthwatt's shared palette. Every ramp runs shadow -> highlight in five steps and is hue-shifted the same
 * way: shadows lean slate-violet, highlights lean warm, which is what ties naturals and industry together.
 */
export type RGB = readonly [number, number, number];
export type Ramp = readonly [RGB, RGB, RGB, RGB, RGB];

export const rgb = (hex: number): RGB => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
export const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

const SHADOW = rgb(0x1c1630);
const LIGHT = rgb(0xfff4d8);
/** Negative amounts sink a colour into the shared violet shadow, positive ones lift it into warm light. */
export const shade = (c: RGB, amount: number): RGB => (amount >= 0 ? mix(c, LIGHT, amount) : mix(c, SHADOW, -amount));

const ramp = (a: number, b: number, c: number, d: number, e: number): Ramp => [rgb(a), rgb(b), rgb(c), rgb(d), rgb(e)];

// ---- naturals: warm, a little desaturated -------------------------------------------------------
export const STONE = ramp(0x5f5a6e, 0x75707f, 0x898486, 0x9b968f, 0xb1ab9d);
export const DEEPSTONE = ramp(0x34313f, 0x45414f, 0x55515c, 0x65616a, 0x7c7880);
export const DIRT = ramp(0x3c2a21, 0x513929, 0x644832, 0x77583b, 0x8f6f4c);
export const GRASS = ramp(0x44552a, 0x56672e, 0x697a36, 0x7d8d41, 0x98a455);
export const SAND = ramp(0xa78146, 0xbb9651, 0xcba960, 0xd8b974, 0xe6cc92);
export const CLAY = ramp(0x76605b, 0x8d7269, 0xa0847a, 0xb1968a, 0xc4ab9d);
export const SNOW = ramp(0xb4bed6, 0xcdd6e6, 0xe2e8f0, 0xf1f4f6, 0xffffff);
export const ICE = ramp(0x6a9fb6, 0x88b9ca, 0xa3ceda, 0xc0e1e8, 0xe8f6f7);
export const BASALT = ramp(0x232129, 0x302e38, 0x3d3b45, 0x4c4a53, 0x66636b);
export const LIMESTONE = ramp(0x9a907e, 0xb3a994, 0xc8bfa8, 0xd8d0ba, 0xe8e1cd);
export const CORESTONE = ramp(0x15121c, 0x1d1a26, 0x262231, 0x332e42, 0x4a4560);
export const WATER = ramp(0x15434f, 0x1c5663, 0x266c78, 0x38878f, 0x74b9b6);
export const LAVA = ramp(0x6a190e, 0xb0300f, 0xe6611a, 0xffa22b, 0xffe27e);

// ---- wood and leaves ----------------------------------------------------------------------------
export const OAK_BARK = ramp(0x3a2d24, 0x4c3b2d, 0x5f4e38, 0x736144, 0x8a7754);
export const PINE_BARK = ramp(0x2a1b19, 0x3c2520, 0x513128, 0x673f30, 0x80533c);
export const WOOD = ramp(0x6a4c2e, 0x86633a, 0xa17c49, 0xb7935a, 0xcdae76);
export const OAK_LEAF = ramp(0x30451f, 0x405825, 0x526d2c, 0x668236, 0x819a46);
export const PINE_LEAF = ramp(0x182e27, 0x213d32, 0x2b4e3d, 0x39614a, 0x52805e);
export const STRAW = ramp(0x574630, 0x776043, 0x978057, 0xb59c6c, 0xd2bb8a);

// ---- soot and ember: masonry, casings, fire -----------------------------------------------------
export const BRICK = ramp(0x662c24, 0x7f372a, 0x984634, 0xae5840, 0xc67352);
export const FIREBRICK = ramp(0x8a6648, 0xa47c56, 0xbc956a, 0xcfab80, 0xe2c49b);
export const FIRED_CLAY = ramp(0x753f2d, 0x915238, 0xab6846, 0xc0805a, 0xd59b75);
export const IRON = ramp(0x1c1c23, 0x28282f, 0x35353d, 0x46464f, 0x61616b);
export const ARC_STEEL = ramp(0x1b202c, 0x27303f, 0x354152, 0x475568, 0x66778c);
export const STAR_ALLOY = ramp(0x14122a, 0x1e1c3a, 0x2a274e, 0x3a3666, 0x565089);
export const GOLD = ramp(0x6e4a14, 0x9c7220, 0xc99c36, 0xecc758, 0xfff0a8);
export const CONCRETE = ramp(0x747679, 0x86888a, 0x959796, 0xa3a4a1, 0xb5b5b0);
export const SOOT = rgb(0x0e0c10);
export const MORTAR = rgb(0x8f8172);

/** Fire by temperature: dull red -> orange -> yellow-white. */
export const EMBER = ramp(0x4a120e, 0x9a2416, 0xd8481e, 0xff8a1e, 0xffd45a);
export const ARC_GLOW = ramp(0x1c3f9e, 0x4d8dff, 0xa9d8ff, 0xfff6c0, 0xffffff);
export const PLASMA = ramp(0x3a1670, 0x6a2ad0, 0xa86cff, 0xe0c8ff, 0xffffff);
export const STARFIRE = ramp(0x7a4a10, 0xd08a1c, 0xffc83c, 0xfff0a0, 0xffffff);

/** The one "this has power" colour. */
export const CYAN_OFF = rgb(0x1b363e);
export const CYAN = rgb(0x3fd8e6);
export const CYAN_GLOW = rgb(0xb8fbff);
export const HAZARD = rgb(0xe0b424);

// ---- metals and made materials ------------------------------------------------------------------
export const COPPER = ramp(0x6a3220, 0x964a29, 0xc36c38, 0xe09259, 0xf7c591);
export const VERDIGRIS = rgb(0x4f9c88);
export const TIN = ramp(0x7c8280, 0x9fa6a0, 0xc1c7be, 0xdce0d3, 0xf5f6ea);
export const BRONZE = ramp(0x5a4020, 0x83602a, 0xab8338, 0xcca44d, 0xebd17e);
export const IRON_METAL = ramp(0x42444c, 0x5c5f67, 0x797d84, 0x979ba1, 0xbdc1c5);
export const STEEL = ramp(0x465570, 0x687c98, 0x90a6c0, 0xb8cbde, 0xe8f2fa);
export const ALUMINUM = ramp(0x7f94a2, 0xa7b9c4, 0xc9d6dc, 0xe3eaec, 0xfcfefe);
export const TUNGSTEN = ramp(0x232936, 0x353e4d, 0x4a5566, 0x637184, 0x8c9bad);
export const SUPERALLOY = ramp(0x35295a, 0x52417e, 0x7460a2, 0x9a8cc6, 0xc6f2e8);
export const GRAPHITE = ramp(0x141519, 0x222329, 0x32333a, 0x484951, 0x6e6f7a);
export const CERAMIC = ramp(0x8f8676, 0xb5ab98, 0xd6cdb9, 0xebe4d2, 0xfbf7ea);
export const GLASS = ramp(0x5f8f9c, 0x8fbcc6, 0xbfe2e8, 0xdff3f5, 0xffffff);
export const RUST = ramp(0x5a281b, 0x82371f, 0xa54e29, 0xc6713d, 0xe09a5c);
export const SULFUR = ramp(0x857014, 0xb4961c, 0xdabd2c, 0xf0db58, 0xfff7b4);
export const QUARTZ = ramp(0x9a6c80, 0xc294a6, 0xe4bccb, 0xf5e2e8, 0xffffff);
export const LILAC = ramp(0x66568a, 0x8a77b0, 0xad9ad0, 0xcfc1e8, 0xf2ebfb);
export const COAL = ramp(0x0e0e12, 0x1a1a20, 0x282830, 0x45455a, 0x8c8ca8);
export const URANIUM = ramp(0x1c3a14, 0x3a6a1e, 0x66a82c, 0x9ce04a, 0xdcff9a);
export const AMBER = ramp(0x5e3a10, 0x94601a, 0xcf9428, 0xf0c048, 0xffe9a0);
export const YELLOWCAKE = ramp(0x7a5a12, 0xa9811c, 0xd3a82c, 0xecc94c, 0xfbe88c);
export const OXIDE_RED = ramp(0x571d18, 0x7e2a20, 0xa53c2a, 0xc6583c, 0xe3835e);
export const CLOTH = ramp(0x4a4630, 0x66603f, 0x847c50, 0xa29a66, 0xc2bb88);
