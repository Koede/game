/** src/render: everything drawn in 3D, plus the UI's item icons. */
export { Renderer, type ClockLike, type RenderStats } from './renderer';
export { createIconProvider, drawIcon, ICON_SIZE, type IconProvider } from './icons';
export { computeSky, createSkyState, sunAngle, sunHeight, type SkyState } from './skyModel';
export { simTransportFeed, type PacketFeed, type PipeNetFeed, type TransportFeed, type TransportSource } from './tech';
