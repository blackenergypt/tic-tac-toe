# Usa a imagem oficial do Node.js versão 20 como base
FROM node:20

# Define o diretório de trabalho dentro do contêiner
WORKDIR /app

# Atualiza o npm para a versão mais recente e instala o pnpm globalmente
RUN npm install -g npm@latest && npm install -g pnpm

# Instala o curl para o HEALTHCHECK
RUN apt-get update && apt-get install -y curl && apt-get clean

# Copia os arquivos de dependências
COPY package*.json ./

# Instala apenas as dependências de produção usando pnpm
RUN pnpm install --prod

# Copia o restante do código
COPY . .

# Expõe a porta 3000
EXPOSE 3000

# Define variáveis de ambiente
ENV NODE_ENV=production
ENV DEBIAN_FRONTEND=noninteractive
ENV PORT=3000

# Adiciona healthcheck para verificar se o servidor está ativo
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/ || exit 1

# Comando para iniciar o aplicativo
CMD ["pnpm", "start"]