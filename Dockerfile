FROM node:17-alpine

WORKDIR /app
ENV HOST=0.0.0.0

COPY package.json yarn.lock /app/
RUN yarn install

COPY ./* /app/

CMD ["yarn", "start"]
