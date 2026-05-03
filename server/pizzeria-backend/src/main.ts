import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { ValidationPipe } from '@nestjs/common'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import * as dotenv from 'dotenv'
import * as path from 'path'

const envPath = path.resolve(process.cwd(), '.env')
/** In dev: il `.env` vince su `PORT` ereditata (es. 3000 da systemd). In `production` lasciamo priorità alle env della piattaforma. */
const dotenvResult = dotenv.config({
  path: envPath,
  override: process.env.NODE_ENV === 'production' ? false : true,
})

function resolveListenPort(): number {
  const raw = process.env.PORT
  let n: number
  if (raw == null || String(raw).trim() === '') {
    n = 3001
  } else {
    const parsed = Number.parseInt(String(raw).trim(), 10)
    n = Number.isFinite(parsed) && parsed > 0 ? parsed : 3001
  }
  /** In dev: la 3000 è spesso occupata → usa 3001 salvo `ALLOW_LISTEN_3000=true`. In production lascia `PORT` com’è. */
  if (n === 3000 && process.env.NODE_ENV !== 'production') {
    if (process.env.ALLOW_LISTEN_3000 === 'true') return 3000
    // eslint-disable-next-line no-console
    console.warn(
      '[bootstrap] PORT=3000 in dev → uso 3001 (ALLOW_LISTEN_3000=true per tenere la 3000)',
    )
    return 3001
  }
  return n
}

const listenPort = resolveListenPort()

if (process.env.NODE_ENV !== 'production') {
  const n = dotenvResult.parsed ? Object.keys(dotenvResult.parsed).length : 0
  // eslint-disable-next-line no-console
  console.log(`[bootstrap] cwd=${process.cwd()} dotenv=${envPath} keys=${n} PORT→${listenPort}`)
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  if (process.env.SWAGGER_ENABLED !== 'false') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Pizzeria API')
      .setDescription('Backend PizzaManager (auth e integrazioni). Il dato tenant principale è su Supabase.')
      .setVersion('1.0')
      .addBearerAuth()
      .build()
    const document = SwaggerModule.createDocument(app, swaggerConfig)
    SwaggerModule.setup('docs', app, document)
  }

  // 🔐 Validation globale
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )

  // 🌍 Prefisso globale API (best practice SaaS)
  app.setGlobalPrefix('api')

  // CORS per frontend in deploy (es. Firebase / Vercel)
  const corsOrigin = process.env.CORS_ORIGIN || process.env.FRONTEND_URL
  app.enableCors({
    origin: corsOrigin ? corsOrigin.split(',').map((o) => o.trim()) : true,
    credentials: true,
  })

  await app.listen(listenPort)
}

bootstrap()