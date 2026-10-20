# Ranking do Futebol

Painel do futebol mensal do time: o admin cadastra os jogadores, cada jogador dá uma
nota de 1 a 10 para os outros, e o ranking mostra a média de cada um. O botão
**Copiar** copia um prompt pedindo os times balanceados, seguido de `Nome - média`, uma
linha por jogador marcado, para colar numa IA que monta os times.

O login é por código: o jogador digita o email da empresa e recebe um código de acesso.
Só emails cadastrados por um admin conseguem entrar, e o banco garante que ninguém
salva nota no nome de outro nem vê as notas individuais dos outros — só as médias.

- Site estático no GitHub Pages; backend é o Supabase (plano grátis).
- Spec: [`specs/ranking-jogadores/`](specs/ranking-jogadores/) · decisão: [`docs/adr/0001-use-supabase-for-auth-and-data.md`](docs/adr/0001-use-supabase-for-auth-and-data.md)

## Colocando no ar

### 1. Supabase

1. Crie um projeto em [supabase.com](https://supabase.com).
2. **SQL Editor** → cole e rode [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql).
3. Ainda no SQL Editor, cadastre o primeiro admin (você):
   ```sql
   insert into players (name, email, is_admin)
   values ('Bernardo', 'bernardo.gsilva@suaempresa.com.br', true);
   ```
   Os demais jogadores você cadastra pelo próprio site, na aba **Jogadores**.
4. **Authentication → Email Templates**: nos templates **Magic Link** e **Confirm
   signup**, troque o corpo por algo com o código, por exemplo:
   ```html
   <h2>Código de acesso ao Ranking do Futebol</h2>
   <p>Seu código: <strong>{{ .Token }}</strong></p>
   ```
   Sem `{{ .Token }}` o Supabase manda um link em vez do código.
5. **Authentication → URL Configuration**: em *Site URL*, coloque o endereço do GitHub
   Pages (ex.: `https://SEU-USUARIO.github.io/futebol-ranking/`).
6. **Recomendado — Authentication → SMTP Settings**: configure um SMTP próprio (Resend,
   Brevo, Gmail…). O envio embutido do Supabase permite poucos emails por hora, e o time
   inteiro entrando antes do jogo estoura esse limite.
7. **Authentication → Sign In / Providers**: deixe só **Email** ligado, com *Confirm
   email* ativo, e desligue os demais provedores e o login anônimo. O banco já descarta
   senhas e só reconhece emails confirmados, mas não há por que deixar portas
   abertas.
8. **Recomendado**: em *Email OTP Expiration* use 600 segundos (10 min) e, se alguém
   começar a abusar do envio de códigos, ligue o captcha em **Authentication → Attack
   Protection**.
9. **Project Settings → API**: anote a *Project URL* e a *anon public key*.

### 2. GitHub Pages

1. Crie o repositório no GitHub e faça push deste projeto.
2. **Settings → Pages → Source**: *GitHub Actions*.
3. **Settings → Secrets and variables → Actions → Variables**, crie:
   - `VITE_SUPABASE_URL` — a Project URL
   - `VITE_SUPABASE_ANON_KEY` — a anon public key (ela é pública por natureza; quem
     protege os dados são as regras do banco)
   - `VITE_ALLOWED_EMAIL_DOMAIN` — ex.: `suaempresa.com.br` (opcional; com ele o jogador
     digita só `bernardo.gsilva`)
4. Cada push na `main` roda testes e lint, gera o site e publica.

## Desenvolvimento

```bash
cp .env.example .env.local   # preencha com os dados do Supabase
npm install
npm run dev                  # http://localhost:5173
npm test                     # testes (inclui as regras de segurança do banco, em PGlite)
npm run lint                 # ESLint + TypeScript
npm run build                # gera dist/
```

Toda regra de permissão mora em `supabase/migrations/`, nunca no navegador. Para mudar o
banco depois de já ter rodado a migração no Supabase, crie uma nova migração numerada
(`0002_...sql`) em vez de editar a antiga.

## Agendamento da quadra

Comando local que manda a mensagem de reserva da quadra pelo WhatsApp Web, no Chrome
do seu computador:

```bash
npm run quadra -- 24/10            # envia
npm run quadra -- 24/10 --dry-run  # só mostra a mensagem e o número
```

Mensagem enviada: "Bom dia. Tudo bem? A quadra 3 está disponível para o dia 24/10 às
18:30?". O dia aceita `DD/MM` (a próxima ocorrência) ou `DD/MM/AAAA`.

Configuração, uma vez:

1. No `.env.local` (fora do git, o número não vai para o repositório público):
   `COURT_WHATSAPP=<DDI DDD número>`, por exemplo `COURT_WHATSAPP=5511999990000`.
2. Rode o comando. Na primeira vez o Chrome abre o WhatsApp Web pedindo o QR code:
   leia com o celular (você tem 3 minutos). A sessão fica salva em
   `~/.futebol-ranking/whatsapp` e as próximas execuções enviam direto.

Precisa do Google Chrome instalado. Antes de enviar, o comando confere se a mensagem
está pronta na conversa e se ela já não foi enviada (aí não manda de novo). Se algo
falhar, o motivo aparece no terminal e a janela fica aberta para você conferir e
enviar à mão. A pasta da sessão é o seu WhatsApp: não compartilhe nem sincronize. O WhatsApp proíbe automação nos termos de uso: uma mensagem
por semana tem risco baixo, mas não zero.
