import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway'
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import { DatadogLambda } from "datadog-cdk-constructs-v2";
import { table } from 'console';
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class NevInferredSpansDemoStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create DynamoDB table
    const userTable = new dynamodb.Table(this, 'nev-inferred-spans-user-table', {
      tableName: 'nev-inferred-spans-user-table',
      partitionKey: { name: 'uuid', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For development - change for production
    });

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
        DD_COLD_START_TRACING: 'false',
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
      environment: {
        DD_COLD_START_TRACING: 'false',
        TABLE_NAME: userTable.tableName, // DynamoDB table name to write to.
      }
    });

    // Grant necessary permissions.
    queue.grantSendMessages(publisherLambda);
    queue.grantConsumeMessages(consumerLambda);
    userTable.grantWriteData(consumerLambda);

    // Set Consumer Lambda as an SQS Event Source
    consumerLambda.addEventSource(new lambdaEventSources.SqsEventSource(queue));

    // Integrate Datadog monitoring
    const datadogLambdas = new DatadogLambda(this, 'DatadogIntegration', {
      nodeLayerVersion: 124, // Use latest version
      extensionLayerVersion: 77, // Use latest version
      addLayers: true,
      enableDatadogTracing: true,
      enableDatadogLogs: true,
      site: 'datadoghq.com', // Adjust for EU if needed
      // apiKeySecretArn: datadogApiKeySecret.secretArn,
      apiKey: process.env.DD_API_KEY,
      service: 'nev-inferred-spans-demo',
      env: 'production',
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
    
    // Output the DynamoDB table name
    new cdk.CfnOutput(this, 'DynamoDBTableName', {
      value: userTable.tableName,
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
