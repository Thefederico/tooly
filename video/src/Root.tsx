import { Composition } from "remotion";
import { PROMO } from "./Promo";

export const RemotionRoot = () => {
  return (
    <>
      <Composition
        id="Promo16x9"
        component={PROMO}
        durationInFrames={600}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="Promo9x16"
        component={PROMO}
        durationInFrames={600}
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  );
};
