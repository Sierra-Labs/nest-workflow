import { Injectable } from '@nestjs/common';
import * as JSZip from 'jszip';
import * as Docxtemplater from 'docxtemplater';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class ExportService {
  export(data: any, templatePath: string): any {
    // Load the docx file as a binary
    const filePath = path.resolve('public/docx/', templatePath);
    const content = fs.readFileSync(filePath, 'binary');
    const zip = new JSZip(content);
    const doc = new Docxtemplater();
    doc.loadZip(zip);

    // set the templateVariables
    doc.setData(data);

    try {
      // render the document (replace all occurences of {first_name} by John, {last_name} by Doe, ...)
      doc.render();
    } catch (error) {
      const e = {
        message: error.message,
        name: error.name,
        stack: error.stack,
        properties: error.properties,
      };
      console.log(JSON.stringify({ error: e }));
      // The error thrown here contains additional information when logged with JSON.stringify (it contains a property object).
      throw error;
    }

    return doc.getZip().generate({ type: 'nodebuffer' });
  }
}
