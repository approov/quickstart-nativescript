<template>
  <Page actionBarHidden="true">
    <GridLayout rows="auto,*,auto" columns="*" height="100%">
      <Label text="Approov Shapes" class="heading" row="0"></Label>
      <!-- Image Container -->
      <StackLayout orientation="vertical" horizontalAlignment="center" verticalAlignment="center" row="1">
        <Image :src="imageUrl"></Image>

        <Label :text="message" textWrap="true" class="text-center sub-text"></Label>
      </StackLayout>
      <FlexboxLayout col="0" row="2" justifyContent="space-around" margin="20">
        <!-- Buttons -->
        <Button text="Hello" @tap="onHelloButtonTap()" class="-primary -rounded-lg" padding="5"></Button>
        <Button text="Shape" @tap="onShapeButtonTap()" class="-primary -rounded-lg" padding="5"></Button>
      </FlexboxLayout>
    </GridLayout>

  </Page>
</template>

<script lang="ts">
/* Uncomment for Approov */
// import { NSApproov } from '@approov/ns-approov-sdk';

import * as HttpModule from '@nativescript/core/http';

const VERSION = 'v1'; // use v2 for Approov

const HELLO_URL = `https://shapes.approov.io/${VERSION}/hello`;
const SHAPE_URL = `https://shapes.approov.io/${VERSION}/shapes`;

export default {
  data() {
    return {
      message: 'Tap Hello to Start...',
      imageUrl: '~/assets/approov.png',
    }
  },
  methods: {
    onHelloButtonTap() {
      HttpModule.getJSON<any>({
        method: 'GET',
        url: HELLO_URL
      })
      .then((response) => {
        console.log('Hello API Success Response => ', response);
        this.message = response.status;
        this.imageUrl = '~/assets/hello.png';
      })
      .catch((error) => {
        console.log('Hello API Error Response => ', error);
        this.message = `Error: ${error.statusCode}, Message: ${error.reason}`;
        this.imageUrl = '~/assets/confused.png';
      });
    },
    onShapeButtonTap() {
      HttpModule.getJSON<any>({ // Comment when Using Approov
        method: 'GET',
        url: SHAPE_URL
      }).then((resp) => resp.shape ? resp : Promise.reject(resp))

      /* Uncomment for Approov */

      // NSApproov.request({
      //   method: 'GET',
      //   url: SHAPE_URL,
      //   headers: {Authorization: 'token-data'},
      // }).then((resp) => resp.content)
      .then((response) => {
        console.log('Shapes API Success Response => ', response);
        this.message = response.status;
        this.imageUrl = `~/assets/${response.shape.toLowerCase()}.png`;
      })
      .catch((err) => {
        console.log('Shapes API Error Response => ', err);
        this.message = `Error: ${err.statusCode}, Message: ${err.reason}`;
        this.imageUrl = '~/assets/confused.png';
      });
    },
  },
}
</script>
