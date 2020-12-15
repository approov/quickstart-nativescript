import { EventData, Page } from '@nativescript/core';
import * as Observable from '@nativescript/core/data/observable';
import * as HttpModule from '@nativescript/core/http';

/* Uncomment for Approov */
// import { NSApproov } from '@approov/ns-approov-sdk';

const VERSION = 'v1'; // Change to v2 for approov

const HELLO_URL = `https://shapes.approov.io/${VERSION}/hello`;
const SHAPE_URL = `https://shapes.approov.io/${VERSION}/shapes`;

let viewModel;
let page: Page;

// Event handler for Page 'loaded' event attached in main-page.xml
export function pageLoaded(args: EventData) {
  // Get the event sender
  page = <Page>args.object;

  /* Uncomment for Approov */

  // NSApproov.initialize();

  viewModel = Observable.fromObject({
    imageUrl: '~/assets/approov.png',
    message: 'Tap Hello to Start...',
  });
  page.bindingContext = viewModel;
}

export async function onHelloButtonTap() {
  try {
    const response = await HttpModule.getJSON<any>({
      method: 'GET',
      url: HELLO_URL
    });

    console.log('HELLO API Success Response => ', response);

    viewModel.set('message', response.status);
    viewModel.set('imageUrl', '~/assets/hello.png');
  } catch (err) {
    console.log('HELLO API Error Response => ', err);
    viewModel.set('message', `Error: ${err.statusCode}, Message: ${err.reason}`);
    viewModel.set('imageUrl', '~/assets/confused.png');
  }
}

export async function onShapeButtonTap() {
  try {
    const response = await HttpModule.getJSON<any>({ // Comment when Using Approov
      method: 'GET',
      url: SHAPE_URL
    });

    /* Uncomment for Approov */

    // const response = await NSApproov.request({
    //   method: 'GET',
    //   url: SHAPE_URL
    // }).then((resp) => resp.content);
    // console.log('Shapes API Success Response => ', response);

    viewModel.set('message', response.status);
    viewModel.set('imageUrl', `~/assets/${response.shape.toLowerCase()}.png`);
  } catch (err) {
    console.log('Shapes API Error Response => ', err);
    viewModel.set('message', `Error: ${err.statusCode}, Message: ${err.reason}`);
    viewModel.set('imageUrl', '~/assets/confused.png');
  }
}
