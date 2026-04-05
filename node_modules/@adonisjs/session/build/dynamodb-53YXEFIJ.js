import {
  debug_default
} from "./chunk-5ECC6OWF.js";
import "./chunk-PZ5AY32C.js";

// src/stores/dynamodb.ts
import string from "@poppinss/utils/string";
import { MessageBuilder } from "@adonisjs/core/helpers";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import {
  GetItemCommand,
  PutItemCommand,
  DeleteItemCommand,
  UpdateItemCommand
} from "@aws-sdk/client-dynamodb";
var DynamoDBStore = class {
  #client;
  #tableName;
  #keyAttribute;
  #ttlSeconds;
  #valueAttribute = "value";
  #expiresAtAttribute = "expires_at";
  constructor(client, age, options) {
    this.#client = client;
    this.#tableName = options?.tableName ?? "Session";
    this.#keyAttribute = options?.keyAttribute ?? "key";
    this.#ttlSeconds = string.seconds.parse(age);
    debug_default("initiating dynamodb store");
  }
  /**
   * Returns session data. A new item will be created if it's
   * missing.
   */
  async read(sessionId) {
    debug_default("dynamodb store: reading session data %s", sessionId);
    const command = new GetItemCommand({
      TableName: this.#tableName,
      Key: marshall({ [this.#keyAttribute]: sessionId })
    });
    const response = await this.#client.send(command);
    if (!response.Item) {
      return null;
    }
    if (!response.Item[this.#valueAttribute]) {
      return null;
    }
    const item = unmarshall(response.Item);
    const contents = item[this.#valueAttribute];
    const expiresAt = item[this.#expiresAtAttribute];
    if (Date.now() > expiresAt) {
      return null;
    }
    try {
      return new MessageBuilder().verify(contents, sessionId);
    } catch {
      return null;
    }
  }
  /**
   * Write session values to DynamoDB
   */
  async write(sessionId, values) {
    debug_default("dynamodb store: writing session data %s, %O", sessionId, values);
    const message = new MessageBuilder().build(values, void 0, sessionId);
    const command = new PutItemCommand({
      TableName: this.#tableName,
      Item: marshall({
        [this.#keyAttribute]: sessionId,
        [this.#valueAttribute]: message,
        [this.#expiresAtAttribute]: Date.now() + this.#ttlSeconds * 1e3
      })
    });
    await this.#client.send(command);
  }
  /**
   * Cleanup session item by removing it
   */
  async destroy(sessionId) {
    debug_default("dynamodb store: destroying session data %s", sessionId);
    const command = new DeleteItemCommand({
      TableName: this.#tableName,
      Key: marshall({ [this.#keyAttribute]: sessionId })
    });
    await this.#client.send(command);
  }
  /**
   * Updates the value expiry
   */
  async touch(sessionId) {
    debug_default("dynamodb store: touching session data %s", sessionId);
    const command = new UpdateItemCommand({
      TableName: this.#tableName,
      Key: marshall({ [this.#keyAttribute]: sessionId }),
      UpdateExpression: "SET #expires_at = :expires_at",
      ExpressionAttributeNames: {
        "#expires_at": this.#expiresAtAttribute
      },
      ExpressionAttributeValues: marshall({
        ":expires_at": Date.now() + this.#ttlSeconds * 1e3
      })
    });
    await this.#client.send(command);
  }
};
export {
  DynamoDBStore
};
//# sourceMappingURL=dynamodb-53YXEFIJ.js.map