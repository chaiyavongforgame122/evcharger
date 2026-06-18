import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { OcppServer } from './ocpp/ocpp.server';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Allow the LINE Mini App (LIFF) front-end to call the REST API from the browser.
  app.enableCors();

  const port = parseInt(process.env.PORT || '', 10) || 9000;
  await app.listen(port);

  // Attach the raw OCPP 1.6J WebSocket server to Nest's underlying HTTP server,
  // so the charger connects to ws(s)://<host>:<port>/ocpp on the SAME port as the REST API.
  // This makes the CSMS a drop-in replacement for the test server (charger keeps its URL).
  const ocpp = app.get(OcppServer);
  ocpp.attach(app.getHttpServer());

  Logger.log(`EvCharger CSMS listening on :${port}  (REST API + OCPP at /ocpp)`, 'Bootstrap');
}

bootstrap();
