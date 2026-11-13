import { AssetType, defineAssets } from '@iwsdk/core';
import { createStage, createStudioFloor } from './scene-assets/studio.scene-asset.js';

const publicAssetUrl = (filePath: string): string =>
  `${import.meta.env.BASE_URL}${filePath.replace(/^\/+/u, '')}`;

const uikitml = (fileName: string, name: string) => ({
  url: publicAssetUrl(`ui/${fileName}`),
  type: AssetType.UIKitML,
  name,
});

export default defineAssets({
  'studio-floor': createStudioFloor(),
  stage: createStage(),
  board: uikitml('board.uikitml', 'Board'),
  controls: uikitml('controls.uikitml', 'Controls'),
  'chart-left': uikitml('chart-left.uikitml', 'Handshape Chart Left'),
  'chart-right': uikitml('chart-right.uikitml', 'Handshape Chart Right'),
});
