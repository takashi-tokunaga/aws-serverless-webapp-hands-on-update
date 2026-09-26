import { randomBytes } from 'node:crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
    DynamoDBDocumentClient,
    PutCommand,
} from '@aws-sdk/lib-dynamodb';

const ddbClient = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(ddbClient);

const fleet = [
    {
        Name: 'Angel',
        Color: 'White',
        Gender: 'Female',
    },
    {
        Name: 'Gil',
        Color: 'White',
        Gender: 'Male',
    },
    {
        Name: 'Rocinante',
        Color: 'Yellow',
        Gender: 'Female',
    },
];

export const handler = async (event) => {
    if (!event.requestContext?.authorizer) {
        return errorResponse(
            'Authorization not configured',
            event.requestContext?.requestId
        );
    }

    const rideId = toUrlString(randomBytes(16));

    console.log('Received event (', rideId, '): ', event);

    // Cognito User Pools Authorizerからユーザー名を取得
    const username =
        event.requestContext.authorizer.claims['cognito:username'];

    // API Gatewayから渡されたリクエストボディをJSONとして解析
    const requestBody = JSON.parse(event.body);

    const pickupLocation = requestBody.PickupLocation;

    const unicorn = findUnicorn(pickupLocation);

    try {
        await recordRide(rideId, username, unicorn);

        return {
            statusCode: 201,
            body: JSON.stringify({
                RideId: rideId,
                Unicorn: unicorn,
                Eta: '30 seconds',
                Rider: username,
            }),
            headers: {
                'Access-Control-Allow-Origin': '*',
            },
        };
    } catch (err) {
        console.error(err);

        return errorResponse(
            err.message,
            event.requestContext?.requestId
        );
    }
};

// 指定された位置情報からユニコーンを選択
function findUnicorn(pickupLocation) {
    console.log(
        'Finding unicorn for ',
        pickupLocation.Latitude,
        ', ',
        pickupLocation.Longitude
    );

    return fleet[Math.floor(Math.random() * fleet.length)];
}

// DynamoDBにRide情報を保存
async function recordRide(rideId, username, unicorn) {
    const command = new PutCommand({
        TableName: 'Rides',
        Item: {
            RideId: rideId,
            User: username,
            Unicorn: unicorn,
            RequestTime: new Date().toISOString(),
        },
    });

    return ddb.send(command);
}

// ランダムなバイト列をURLセーフな文字列に変換
function toUrlString(buffer) {
    return buffer
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

// エラーレスポンスを生成
function errorResponse(errorMessage, requestId) {
    return {
        statusCode: 500,
        body: JSON.stringify({
            Error: errorMessage,
            Reference: requestId,
        }),
        headers: {
            'Access-Control-Allow-Origin': '*',
        },
    };
}
