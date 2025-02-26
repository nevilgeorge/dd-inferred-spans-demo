import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway'
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';
import { DatadogLambda } from "datadog-cdk-constructs-v2";
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class NevInferredSpansDemoStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here
    
    // SQS queue
    const queue = new sqs.Queue(this, 'nev-inferred-spans-queue', {
      queueName: 'intro-demo-queue',
      visibilityTimeout: cdk.Duration.seconds(30), // Ensure messages remain in the queue if not processed
    });

    // Lambda function for publisher.
    const publisherLambda = new lambda.Function(this, 'nev-inferred-spans-publisher', {
      runtime: lambda.Runtime.NODEJS_20_X,  // Specify runtime
      handler: 'publisher.handler',            // Specify the handler function
      code: lambda.Code.fromAsset('lambda'), // Path to Lambda code
      memorySize: 128,                      // Memory allocation
      timeout: cdk.Duration.seconds(5),     // Timeout in seconds
      environment: {
        SQS_QUEUE_URL: queue.queueUrl,
      }
    });
    
    // Lambda function for consumer.
    const consumerLambda = new lambda.Function(this, 'nev-inferred-spans-consumer', {
      runtime: lambda.Runtime.NODEJS_20_X,  // Specify runtime
      handler: 'consumer.handler',            // Specify the handler function
      code: lambda.Code.fromAsset('lambda'), // Path to Lambda code
      memorySize: 128,                      // Memory allocation
      timeout: cdk.Duration.seconds(5),     // Timeout in seconds
    });

    // Grant necessary permissions.
    queue.grantSendMessages(publisherLambda);
    queue.grantConsumeMessages(consumerLambda);

    // Set Consumer Lambda as an SQS Event Source
    consumerLambda.addEventSource(new lambdaEventSources.SqsEventSource(queue));

    // Integrate Datadog monitoring
    const datadogLambdas = new DatadogLambda(this, 'DatadogIntegration', {
      nodeLayerVersion: 120, // Use latest version
      extensionLayerVersion: 69, // Use latest version
      addLayers: true,
      enableDatadogTracing: true,
      enableDatadogLogs: true,
      site: 'datadoghq.com', // Adjust for EU if needed
      // apiKeySecretArn: datadogApiKeySecret.secretArn,
      apiKey: process.env.DD_API_KEY,
    });

    datadogLambdas.addLambdaFunctions([publisherLambda, consumerLambda]);

    // Create API Gateway and integrate with Lambda
    const apigw = new apigateway.LambdaRestApi(this, 'nev-inferred-spans-apigw', {
      handler: publisherLambda,
      proxy: true, // Forward all requests to Lambda
      deployOptions: {
        stageName: 'prod',
        tracingEnabled: true, // Enable X-Ray tracing for API Gateway
      }
    });

    // Output the SQS queue URL
    new cdk.CfnOutput(this, 'SQSQueueUrl', {
      value: queue.queueUrl,
    });

    // Output API Gateway URL
    new cdk.CfnOutput(this, 'ApiGatewayUrl', {
      value: apigw.url
    });

    // Output publisher function ARN
    new cdk.CfnOutput(this, 'publisherLambdaFunctionArn', {
        value: publisherLambda.functionArn,
    });

    // Output consumer function ARN
    new cdk.CfnOutput(this, 'consumerLambdaFunctionArn', {
        value: consumerLambda.functionArn,
    });
  }
}
