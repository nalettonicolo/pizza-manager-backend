import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { AuthService } from './auth.service'
import { LoginDto } from './dto/login.dto'
import { JwtAuthGuard } from './jwt.guard'

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Login email/password' })
  login(@Body() body: LoginDto) {
    return this.authService.login(body.email, body.password)
  }

  @Post('refresh')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Rinnova access token',
    description:
      'Richiede Bearer JWT ancora valido; restituisce un nuovo token (stesso payload da DB). Utile per sessione sliding.',
  })
  refresh(@Req() req: { user: { sub?: string } }) {
    return this.authService.refresh(req.user)
  }

  @Post('logout')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Logout',
    description:
      'Nessuna sessione server-side oggi: il client rimuove il JWT. Endpoint per simmetria API e revoche future.',
  })
  logout() {
    return
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Profilo da JWT (Bearer)' })
  me(@Req() req: { user: { sub: string } }) {
    return this.authService.me(req.user)
  }
}