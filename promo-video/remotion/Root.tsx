import React from 'react';
import { Composition } from 'remotion';
import { PromoVideo } from './PromoVideo';
import {
  FPS,
  HEIGHT,
  LONG_DURATION_SECONDS,
  SHORT_DURATION_SECONDS,
  WIDTH,
} from './content';

export function RemotionRoot() {
  return (
    <>
      <Composition
        id="MBKParentPortalPromo"
        component={PromoVideo}
        width={WIDTH}
        height={HEIGHT}
        fps={FPS}
        durationInFrames={LONG_DURATION_SECONDS * FPS}
        defaultProps={{ short: false }}
      />
      <Composition
        id="MBKParentPortalShort"
        component={PromoVideo}
        width={WIDTH}
        height={HEIGHT}
        fps={FPS}
        durationInFrames={SHORT_DURATION_SECONDS * FPS}
        defaultProps={{ short: true }}
      />
    </>
  );
}
