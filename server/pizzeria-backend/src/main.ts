import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { ValidationPipe } from '@nestjs/common'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import * as dotenv from 'dotenv'

dotenv.config()

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

  await app.listen(process.env.PORT ?? 3000)
}

bootstrap()