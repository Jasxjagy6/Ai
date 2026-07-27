FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY bot.mjs ./bot.mjs

RUN addgroup --system trialbot \
    && adduser --system --ingroup trialbot trialbot \
    && mkdir -p /app/data \
    && chown -R trialbot:trialbot /app/data
USER trialbot

CMD ["node", "bot.mjs"]
