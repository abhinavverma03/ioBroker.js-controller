[@iobroker/js-controller-adapter](../README.md) / [Exports](../modules.md) / [<internal\>](../modules/internal_.md) / HostObject

# Interface: HostObject

[<internal>](../modules/internal_.md).HostObject

## Hierarchy

- [`BaseObject`](internal_.BaseObject.md)

  ↳ **`HostObject`**

## Table of contents

### Properties

- [\_id](internal_.HostObject.md#_id)
- [acl](internal_.HostObject.md#acl)
- [common](internal_.HostObject.md#common)
- [enums](internal_.HostObject.md#enums)
- [from](internal_.HostObject.md#from)
- [native](internal_.HostObject.md#native)
- [ts](internal_.HostObject.md#ts)
- [type](internal_.HostObject.md#type)
- [user](internal_.HostObject.md#user)

## Properties

### \_id

• **\_id**: \`system.host.${string}\`

The ID of this object

#### Overrides

[BaseObject](internal_.BaseObject.md).[_id](internal_.BaseObject.md#_id)

#### Defined in

[types-dev/objects.d.ts:658](https://github.com/ioBroker/ioBroker.js-controller/blob/a9d11a29/packages/types-dev/objects.d.ts#L658)

___

### acl

• `Optional` **acl**: [`ObjectACL`](internal_.ObjectACL.md)

#### Inherited from

[BaseObject](internal_.BaseObject.md).[acl](internal_.BaseObject.md#acl)

#### Defined in

[types-dev/objects.d.ts:577](https://github.com/ioBroker/ioBroker.js-controller/blob/a9d11a29/packages/types-dev/objects.d.ts#L577)

___

### common

• **common**: [`HostCommon`](internal_.HostCommon.md)

#### Overrides

[BaseObject](internal_.BaseObject.md).[common](internal_.BaseObject.md#common)

#### Defined in

[types-dev/objects.d.ts:660](https://github.com/ioBroker/ioBroker.js-controller/blob/a9d11a29/packages/types-dev/objects.d.ts#L660)

___

### enums

• `Optional` **enums**: `Record`<`string`, `string`\>

#### Inherited from

[BaseObject](internal_.BaseObject.md).[enums](internal_.BaseObject.md#enums)

#### Defined in

[types-dev/objects.d.ts:576](https://github.com/ioBroker/ioBroker.js-controller/blob/a9d11a29/packages/types-dev/objects.d.ts#L576)

___

### from

• `Optional` **from**: `string`

#### Inherited from

[BaseObject](internal_.BaseObject.md).[from](internal_.BaseObject.md#from)

#### Defined in

[types-dev/objects.d.ts:578](https://github.com/ioBroker/ioBroker.js-controller/blob/a9d11a29/packages/types-dev/objects.d.ts#L578)

___

### native

• **native**: [`HostNative`](internal_.HostNative.md)

#### Overrides

[BaseObject](internal_.BaseObject.md).[native](internal_.BaseObject.md#native)

#### Defined in

[types-dev/objects.d.ts:661](https://github.com/ioBroker/ioBroker.js-controller/blob/a9d11a29/packages/types-dev/objects.d.ts#L661)

___

### ts

• `Optional` **ts**: `number`

#### Inherited from

[BaseObject](internal_.BaseObject.md).[ts](internal_.BaseObject.md#ts)

#### Defined in

[types-dev/objects.d.ts:581](https://github.com/ioBroker/ioBroker.js-controller/blob/a9d11a29/packages/types-dev/objects.d.ts#L581)

___

### type

• **type**: ``"host"``

#### Overrides

[BaseObject](internal_.BaseObject.md).[type](internal_.BaseObject.md#type)

#### Defined in

[types-dev/objects.d.ts:659](https://github.com/ioBroker/ioBroker.js-controller/blob/a9d11a29/packages/types-dev/objects.d.ts#L659)

___

### user

• `Optional` **user**: `string`

The user who created or updated this object

#### Inherited from

[BaseObject](internal_.BaseObject.md).[user](internal_.BaseObject.md#user)

#### Defined in

[types-dev/objects.d.ts:580](https://github.com/ioBroker/ioBroker.js-controller/blob/a9d11a29/packages/types-dev/objects.d.ts#L580)