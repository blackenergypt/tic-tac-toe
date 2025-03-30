# Usa a imagem oficial do Node.js versão 20 como base
FROM node:20

# Define o diretório de trabalho dentro do contêiner
WORKDIR /app

# Instala o pnpm globalmente
RUN npm install -g pnpm

# Copia os arquivos de dependências
COPY package*.json ./

# Instala as dependências do projeto usando pnpm
RUN pnpm install --prod  # Equivalente a --production no npm

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