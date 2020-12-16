/*
In NativeScript, a file with the same name as an XML file is known as
a code-behind file. The code-behind is a great place to place your view
logic, and to set up your page’s data binding.
*/

import { EventData, Page } from '@nativescript/core';
import * as Observable from '@nativescript/core/data/observable';
import * as HttpModule from '@nativescript/core/http';

/* uncomment for Approov */
// import { NSApproov } from '@approov/ns-approov-sdk';

const VERSION = 'v1'; // change to v2 for Approov

const HELLO_URL = `https://shapes.approov.io/${VERSION}/hello`;
const SHAPE_URL = `https://shapes.approov.io/${VERSION}/shapes`;

let viewModel;
let page: Page;

// Event handler for Page 'navigatingTo' event attached in main-page.xml
export function navigatingTo(args: EventData) {
    /*
    This gets a reference this page’s <Page> UI component. You can
    view the API reference of the Page to see what’s available at
    https://docs.nativescript.org/api-reference/classes/_ui_page_.page.html
    */
    const page = <Page>args.object;

    /* uncomment for Approov */
    // NSApproov.initialize();

    viewModel = Observable.fromObject({
        imageUrl: '~/assets/approov.png',
        message: 'Tap Hello to Start...',
        error: '',
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
        viewModel.set('message', JSON.stringify(err))
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
        //  method: 'GET',
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
