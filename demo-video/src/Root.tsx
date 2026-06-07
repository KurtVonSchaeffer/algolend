import { Composition } from 'remotion';
import { DemoVideo } from './DemoVideo';

export const RemotionRoot = () => {
  return (
    <>
      <Composition
        id="WidescreenDemo"
        component={DemoVideo}
        durationInFrames={1800} // 60 seconds @ 30fps
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          aspectRatio: '16:9'
        }}
      />
      <Composition
        id="VerticalDemo"
        component={DemoVideo}
        durationInFrames={1800} // 60 seconds @ 30fps
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          aspectRatio: '9:16'
        }}
      />
    </>
  );
};
