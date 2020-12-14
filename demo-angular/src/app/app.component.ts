import { Component } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';

@Component({
  selector: 'ns-app',
  moduleId: module.id,
  templateUrl: './app.component.html'
})
export class AppComponent {
  readonly imageBaseUrl = '~/assets/';
  readonly imageExtension = 'png';
  readonly VERSION = 'v1'; // Change To v2 when using Approov
  readonly HELLO_URL = `https://shapes.approov.io/${this.VERSION}/hello`;
  readonly SHAPE_URL = `https://shapes.approov.io/${this.VERSION}/shapes`;

  private image = 'approov';

  message = 'Tap Hello to Start...';
  imageUrl = this.getImageUrl(this.image);

  constructor(private httpClient: HttpClient) {
  }

  onHelloButtonTap(): void {
    this.httpClient.get(this.HELLO_URL, { headers: { Authorization: 'key-token' } }).subscribe({
      next: (response: { text: string; message: string }) => {
        console.log('Response => ', response);
        this.message = response.text;
        this.imageUrl = this.getImageUrl('hello');
      },
      error: (errorResponse: HttpErrorResponse) => {
        console.log('HTTP ERROR HELLO => ', errorResponse);
        this.message = `Error: ${errorResponse.status}, Message: ${errorResponse.statusText}`;
        this.imageUrl = this.getImageUrl('confused');
      }
    });
  }

  onShapeButtonTap(): void {
    this.httpClient.get(this.SHAPE_URL, { headers: { Authorization: 'key-token' } }).subscribe({
      next: (response: any) => {
        console.log('Response => ', response);
        this.message = response.status;
        this.imageUrl = this.getImageUrl(response.shape.toLowerCase());
      },
      error: (err: HttpErrorResponse) => {
        console.log('Shapes API Error Response => ', err);
        this.message = `Error: ${err.status}, Message: ${err.statusText}`;
        this.imageUrl = this.getImageUrl('confused');
      }
    });
  }

  getImageUrl(name: string): string {
    return `${this.imageBaseUrl}${name}.${this.imageExtension}`;
  }
}
