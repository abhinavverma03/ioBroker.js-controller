[@iobroker/js-controller-adapter](../README.md) / [Exports](../modules.md) / [<internal\>](../modules/internal_.md) / PartialEnumObject

# Interface: PartialEnumObject

[<internal>](../modules/internal_.md).PartialEnumObject

## Hierarchy

- `Partial`<`Omit`<[`EnumObject`](internal_.EnumObject.md), ``"common"``\>\>

  ↳ **`PartialEnumObject`**

## Table of contents

### Properties

- [\_id](internal_.PartialEnumObject.md#_id)
- [acl](internal_.PartialEnumObject.md#acl)
- [common](internal_.PartialEnumObject.md#common)
- [enums](internal_.PartialEnumObject.md#enums)
- [from](internal_.PartialEnumObject.md#from)
- [native](internal_.PartialEnumObject.md#native)
- [nonEdit](internal_.PartialEnumObject.md#nonedit)
- [ts](internal_.PartialEnumObject.md#ts)
- [type](internal_.PartialEnumObject.md#type)
- [user](internal_.PartialEnumObject.md#user)

## Properties

### \_id

• `Optional` **\_id**: `string`

The ID of this object

#### Inherited from

Partial.\_id

#### Defined in

[types-dev/objects.d.ts:623](https://github.com/ioBroker/ioBroker.js-controller/blob/ac19e215/packages/types-dev/objects.d.ts#L623)

___

### acl

• `Optional` **acl**: [`ObjectACL`](internal_.ObjectACL.md)

#### Inherited from

Partial.acl

#### Defined in

[types-dev/objects.d.ts:630](https://github.com/ioBroker/ioBroker.js-controller/blob/ac19e215/packages/types-dev/objects.d.ts#L630)

___

### common

• `Optional` **common**: `Partial`<[`EnumCommon`](internal_.EnumCommon.md)\>

#### Defined in

[types-dev/objects.d.ts:679](https://github.com/ioBroker/ioBroker.js-controller/blob/ac19e215/packages/types-dev/objects.d.ts#L679)

___

### enums

• `Optional` **enums**: `Record`<`string`, `string`\>

#### Inherited from

Partial.enums

#### Defined in

[types-dev/objects.d.ts:629](https://github.com/ioBroker/ioBroker.js-controller/blob/ac19e215/packages/types-dev/objects.d.ts#L629)

___

### from

• `Optional` **from**: `string`

#### Inherited from

Partial.from

#### Defined in

[types-dev/objects.d.ts:631](https://github.com/ioBroker/ioBroker.js-controller/blob/ac19e215/packages/types-dev/objects.d.ts#L631)

___

### native

• `Optional` **native**: `Record`<`string`, `any`\>

#### Inherited from

Partial.native

#### Defined in

[types-dev/objects.d.ts:627](https://github.com/ioBroker/ioBroker.js-controller/blob/ac19e215/packages/types-dev/objects.d.ts#L627)

___

### nonEdit

• `Optional` **nonEdit**: [`NonEditable`](internal_.NonEditable.md)

These properties can only be edited if correct password is provided

#### Inherited from

Partial.nonEdit

#### Defined in

[types-dev/objects.d.ts:636](https://github.com/ioBroker/ioBroker.js-controller/blob/ac19e215/packages/types-dev/objects.d.ts#L636)

___

### ts

• `Optional` **ts**: `number`

#### Inherited from

Partial.ts

#### Defined in

[types-dev/objects.d.ts:634](https://github.com/ioBroker/ioBroker.js-controller/blob/ac19e215/packages/types-dev/objects.d.ts#L634)

___

### type

• `Optional` **type**: ``"enum"``

#### Inherited from

Partial.type

#### Defined in

[types-dev/objects.d.ts:675](https://github.com/ioBroker/ioBroker.js-controller/blob/ac19e215/packages/types-dev/objects.d.ts#L675)

___

### user

• `Optional` **user**: `string`

The user who created or updated this object

#### Inherited from

Partial.user

#### Defined in

[types-dev/objects.d.ts:633](https://github.com/ioBroker/ioBroker.js-controller/blob/ac19e215/packages/types-dev/objects.d.ts#L633)
