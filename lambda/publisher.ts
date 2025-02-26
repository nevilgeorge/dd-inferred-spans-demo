import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs'

const sqs = new SQSClient({ region: "us-east-1" });

/**
 * AWS Lambda handler function
 * @param event - API Gateway event
 * @param context - Lambda execution context
 * @returns APIGatewayProxyResult
 */
export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  console.log("Lambda function triggered with event:", event);
  console.log("Lambda function triggered with context:", context);

  if (!event.body) {
    return {
        statusCode: 400,
        body: JSON.stringify({
            message: "Invalid JSON format",
            requestId: context.awsRequestId,
        }),
    }
  }

  const body = JSON.parse(event.body)
  
  if (!body['firstName'] || !body['lastName']) {
    return {
        statusCode: 400,
        body: JSON.stringify({
            message: "Body requires firstName and lastName",
            requestId: context.awsRequestId,
        }),
    };
  }
  
  const queueUrl = process.env.SQS_QUEUE_URL;
  try {
    const result = await sqs.send(new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: JSON.stringify(body)
    }));
  } catch (error) {
    console.error("Failed to send message:", error);
    return { statusCode: 500, body: "Failed to send message" };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: "Successfully sent to queue!",
      requestId: context.awsRequestId,
      receiveBody: JSON.parse(event.body),
    }),
  };
};
