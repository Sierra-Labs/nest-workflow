export class FileCreatePresignedDto {
  mimeType: string;
}

export class FilePresignedDto {
  destinationUrl: string;
  signedUrl: string;
  expiration: number;
}
