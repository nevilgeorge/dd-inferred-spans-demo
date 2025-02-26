import { APIGatewayProxyResult, SQSEvent } from "aws-lambda";

/**
 * AWS Lambda handler function
 * @param event - API Gateway event
 * @param context - Lambda execution context
 * @returns APIGatewayProxyResult
 */
export const handler = async (
  event: SQSEvent,
): Promise<APIGatewayProxyResult> => {
  console.log("Received SQS message:", JSON.stringify(event));

  for (const record of event.Records) {
    const messageBody = JSON.parse(record.body)
    console.log(`Hello ${messageBody.firstName} ${messageBody.lastName}, welcome to Lambda + SQS traces with Datadog!`);
  }

  return {statusCode: 200, body: 'Messages processed!'};
};
