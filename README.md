# solid-webcam

Webcam component for Solid.js. See [http://caniuse.com/#feat=stream](http://caniuse.com/#feat=stream)
for browser compatibility.

**Note: Browsers will throw an error if the page is loaded from insecure origin - use https.**

That package is port from [react-webcam](https://www.npmjs.com/package/react-webcam) to Solid.js. Shout-out to contributors of it.

## Installation

[npm](https://www.npmjs.com/package/solid-webcam)

```shell
# with npm
npm install solid-webcam
```

## Demo

[StackBlitz](https://stackblitz.com/edit/solidjs-webcam)

## Usage

```jsx
import Webcam from "solid-webcam";

const WebcamWrapper = () => <Webcam />;
```

### Props

The props here are specific to this component but one can pass any prop to the underlying video tag eg `className`, `style`, `muted`, etc

| prop             | type     | default | notes                                                                                |
| ---------------- | -------- | ------- | ------------------------------------------------------------------------------------ |
| audio            | boolean  | false   | enable/disable audio                                                                 |
| audioConstraints | object   |         | MediaStreamConstraint(s) for the audio                                               |
| onUserMedia      | function | noop    | callback for when component receives a media stream                                  |
| onUserMediaError | function | noop    | callback for when component can't receive a media stream with MediaStreamError param |
| videoConstraints | object   |         | MediaStreamConstraints(s) for the video                                              |

### Methods

`getScreenshot` - Returns a base64 encoded string of the current webcam image.

Configuration option object for `getScreenshot`

| prop                      | type    | default      | notes                                                                                   |
| ------------------------- | ------- | ------------ | --------------------------------------------------------------------------------------- |
| forceScreenshotSourceSize | boolean | false        | uses size of underlying source video stream (and thus ignores other size related props) |
| imageSmoothing            | boolean | true         | pixel smoothing of the screenshot taken                                                 |
| mirrored                  | boolean | false        | show camera preview and get the screenshot mirrored                                     |
| minScreenshotHeight       | number  |              | min height of screenshot                                                                |
| minScreenshotWidth        | number  |              | min width of screenshot                                                                 |
| screenshotFormat          | string  | 'image/webp' | format of screenshot                                                                    |
| screenshotQuality         | number  | 0.92         | quality of screenshot(0 to 1)                                                           |

You can find an example at [StackBlitz](https://stackblitz.com/edit/solidjs-webcam).

### The Constraints

We can build a constraints object by passing it to the videoConstraints prop. This gets passed into getUserMedia method. Please take a look at the MDN docs to get an understanding how this works.

https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
https://developer.mozilla.org/en-US/docs/Web/API/Media_Streams_API/Constraints

## Screenshot (via ref)

```jsx
import Webcam, { getScreenshot } from "solid-webcam";

const videoConstraints = {
  width: 1280,
  height: 720,
  facingMode: "user",
};

export const WebcamWrapper = () => {
  let webcamRef: HTMLVideoElement;

  const capture = () => {
    const imageSrc = getScreenshot(webcamRef, videoConstraints);
    console.log(imageSrc);
  };

  return (
    <>
      <Webcam audio={false} width={1280} height={720} ref={webcamRef} />
      <button onClick={capture}>Capture photo</button>
    </>
  );
};
```

### User/Selfie/forward facing camera

```jsx
<Webcam videoConstraints={{ facingMode: "user" }} />
```

### Environment/Facing-Out camera

```jsx
<Webcam videoConstraints={{ facingMode: { exact: "environment" } }} />
```

For more information on `facingMode`, please see the MDN web docs [https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackConstraints/facingMode](https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackConstraints/facingMode)

## Show all cameras by deviceId

Get `devices` list with `navigator.mediaDevices.enumerateDevices()`

```jsx
<Webcam audio={false} videoConstraints={{ deviceId: device.deviceId }} />
```

## Using within an iframe

The Webcam component will fail to load when used inside a cross-origin iframe in newer version of Chrome (> 64). In order to overcome this security restriction a special `allow` attribute needs to be added to the iframe tag specifying `microphone` and `camera` as the required permissions like in the below example:

```html
<iframe
  src="https://my-website.com/page-with-webcam"
  allow="camera; microphone;"
/>
```

## Mirrored video but non-mirrored screenshot

Add `mirrored` prop to the component will make the video and the screenshot be mirrored, but sometimes you need to show a mirrored video but take a non-mirrored screenshot, to accomplish that, you just need to add this CSS to your project:

```css
video {
  transform: scaleX(-1);
}
```

## License

MIT
