import Webcam, { getScreenshot } from './Webcam';

export const WebcamWrapper = () => {
  let webcamRef: HTMLVideoElement;

  const capture = () => {
    const imageSrc = getScreenshot(webcamRef);
    console.log(imageSrc);
  };

  return (
    <>
      <Webcam audio={false} width={1280} height={720} ref={webcamRef} />
      <button onClick={capture}>Capture photo</button>
    </>
  );
};
