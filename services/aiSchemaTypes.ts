/**
 * AI Schema Type Abstraction Layer
 *
 * 彻底移除对第三方 SDK 的耦合，定义我们自己的 SchemaType 字面量枚举。
 */

export enum SchemaType {
	STRING = 'STRING',
	NUMBER = 'NUMBER',
	BOOLEAN = 'BOOLEAN',
	ARRAY = 'ARRAY',
	OBJECT = 'OBJECT',
}
