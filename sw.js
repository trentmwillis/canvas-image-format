self.addEventListener('fetch', (event) => {

  if (isCanvasRequest(event.request)) {

    event.respondWith(makePNGResponseFromCanvasRequest(event.request));

  }

});

function isCanvasRequest(request) {

  return request.url.split('.').pop() === 'canvas';

}

async function makePNGResponseFromCanvasRequest(request) {

  const response = await fetch(request); // Fetch the canvas image
  const transform = new CanvasToPNGTransformStream(); // Create a transform stream
  const pngStream = response.body.pipeThrough(transform); // Feed the canvas image through the transform
  const data = await pngStream.getReader().read(); // Wait for the transform to complete
  const pngBlob = data.value;

  return new Response(pngBlob); // Respond with the PNG result as a blob

}

class CanvasToPNGTransformStream {

  constructor() {

    const transformer = new CanvasToPNGTransformer();

    this.writable = new WritableStream({
      write(data) { // Called for each chunk of data for the image

        transformer.write(data);

      },

      close() { // Called when the image download is finished

        transformer.close();

      },
    });

    this.readable = new ReadableStream({
      start(controller) {

        transformer.onClose = (data) => { // When an image is ready, pass the blob to the controller

          controller.enqueue(data);
          controller.close();

        };

      },
    });

  }

}

class CanvasToPNGTransformer {

  constructor() {

    this.textDecoder = new TextDecoder();

    this.offscreenCanvas = null;
    this.renderingContext = null;

    this.onClose = null;

  }

  write(data) {

    const lines = this.textDecoder.decode(data).split('\n');
    for (let i = 0; i < lines.length; i++) {

      const tokens = lines[i].split(' ');
      const command = tokens.shift();

      switch (command) {

        case 'dimensions':
          this.offscreenCanvas = new OffscreenCanvas(+tokens[0], +tokens[1]);
          break;

        case 'context':
          this.renderingContext = this.offscreenCanvas.getContext(tokens[0]);
          break;

        case 'fillStyle':
        case 'strokeStyle':
          this.renderingContext[command] = tokens[0];
          break;

        default:
          this.renderingContext[command](...tokens);

      }

    }

  }

  async close() {

    this.onClose(await this.offscreenCanvas.convertToBlob());

  }

}
