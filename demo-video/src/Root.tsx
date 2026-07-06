import { Composition } from 'remotion';
import { DemoVideo, TOTAL_FRAMES } from './DemoVideo';

export const RemotionRoot = () => {
  return (
    <>
      <Composition
        id="WidescreenDemo"
        component={DemoVideo}
        durationInFrames={TOTAL_FRAMES} // 1950 = 65s @ 30fps (1 min 5 sec)
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{}}
      />
    </>
  );
};
