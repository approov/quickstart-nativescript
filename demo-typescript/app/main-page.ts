import { Application, EventData, Page } from '@nativescript/core';
import * as Observable from '@nativescript/core/data/observable';
import * as HttpModule from '@nativescript/core/http';

// CHANGE TO v3 FOR APPROOV API PROTECTION
const VERSION = 'v1';

const HELLO_URL = `https://shapes.approov.io/${VERSION}/hello`;
const SHAPE_URL = `https://shapes.approov.io/${VERSION}/shapes`;

// COMMENT THE LINE BELOW IF USING APPROOV WITH SECRETS PROTECTION
const API_KEY = "yXClypapWNHIifHUWmBIyPFAm";

// UNCOMMENT THE LINE BELOW IF USING APPROOV WITH SECRETS PROTECTION
//const API_KEY = "shapes_api_key_placeholder";

// UNCOMMENT FOR APPROOV
//import { ApproovService } from '@approov/nativescript-approov';
//ApproovService.initialize("<enter-your-config-string-here>");

// UNCOMMENT FOR APPROOV WITH SECRETS PROTECTION
//ApproovService.addSubstitutionHeader("Api-Key", "");

let viewModel;
let page: Page;

// Event handler for Page 'loaded' event attached in main-page.xml
export function pageLoaded(args: EventData) {
  page = <Page>args.object;
  viewModel = Observable.fromObject({
    imageUrl: '~/assets/approov.png',
    message: 'Tap Hello to Start...',
  });
  page.bindingContext = viewModel;
}

export async function onHelloButtonTap() {
  console.log('Hello Tapped');
  HttpModule.getJSON<any>({
    method: 'GET',
    url: HELLO_URL,
    dontFollowRedirects: true
  }).then((response: any) => {
    console.log('Hello API Success Response => ', response);
    viewModel.set('message', response.status);
    viewModel.set('imageUrl', '~/assets/hello.png');
  }, (error: any) => {
    console.log('Hello API Error Response');
    viewModel.set('message', `Error response`);
    viewModel.set('imageUrl', '~/assets/confused.png');
  })
}

export async function onShapeButtonTap() {
  console.log('Shape Tapped');
  HttpModule.getJSON<any>({
    method: 'GET',
    url: SHAPE_URL,
    headers: {"Api-Key": API_KEY}
  }).then((response: any) => {
    console.log('Shapes API Success Response => ', response);
    viewModel.set('message', response.status);
    if (response.shape)
      viewModel.set('imageUrl', `~/assets/${response.shape.toLowerCase()}.png`);
    else
      viewModel.set('imageUrl', '~/assets/confused.png');
  }, (error: any) => {
    console.log('Shapes API Error Response');
    viewModel.set('message', `Error response`);
    viewModel.set('imageUrl', '~/assets/confused.png');
  })
}
