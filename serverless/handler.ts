import { APIGatewayProxyHandler } from 'aws-lambda';
import 'source-map-support/register';
import * as line from '@line/bot-sdk'

export const received: APIGatewayProxyHandler = async (event, _context) => {
  const lineClient = new line.Client({
    channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
    channelSecret: process.env.CHANNEL_SECRET,
  });
  console.log(event);
  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'Go Serverless Webpack (Typescript) v1.0! Your function executed successfully!',
      input: event,
    }, null, 2),
  };
}
