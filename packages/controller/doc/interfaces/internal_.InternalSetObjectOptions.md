[@iobroker/js-controller-adapter](../README.md) / [Exports](../modules.md) / [<internal\>](../modules/internal_.md) / InternalSetObjectOptions

# Interface: InternalSetObjectOptions

[<internal>](../modules/internal_.md).InternalSetObjectOptions

## Table of contents

### Properties

- [callback](internal_.InternalSetObjectOptions.md#callback)
- [id](internal_.InternalSetObjectOptions.md#id)
- [obj](internal_.InternalSetObjectOptions.md#obj)
- [options](internal_.InternalSetObjectOptions.md#options)

## Properties

### callback

• `Optional` **callback**: [`SetObjectCallback`](../modules/internal_.md#setobjectcallback)

#### Defined in

[adapter/src/lib/_Types.ts:202](https://github.com/ioBroker/ioBroker.js-controller/blob/ac19e215/packages/adapter/src/lib/_Types.ts#L202)

___

### id

• **id**: `string`

#### Defined in

[adapter/src/lib/_Types.ts:199](https://github.com/ioBroker/ioBroker.js-controller/blob/ac19e215/packages/adapter/src/lib/_Types.ts#L199)

___

### obj

• **obj**: `Omit`<[`StateObject`](internal_.StateObject.md), ``"_id"`` \| ``"acl"``\> & { `_id?`: `string` ; `acl?`: [`StateACL`](internal_.StateACL.md)  } \| `Omit`<[`ChannelObject`](internal_.ChannelObject.md), ``"_id"`` \| ``"acl"``\> & { `_id?`: `string` ; `acl?`: [`ObjectACL`](internal_.ObjectACL.md)  } \| `Omit`<[`DeviceObject`](internal_.DeviceObject.md), ``"_id"`` \| ``"acl"``\> & { `_id?`: `string` ; `acl?`: [`ObjectACL`](internal_.ObjectACL.md)  } \| `Omit`<[`FolderObject`](internal_.FolderObject.md), ``"_id"`` \| ``"acl"``\> & { `_id?`: `string` ; `acl?`: [`ObjectACL`](internal_.ObjectACL.md)  } \| `Omit`<[`EnumObject`](internal_.EnumObject.md), ``"_id"`` \| ``"acl"``\> & { `_id?`: `string` ; `acl?`: [`ObjectACL`](internal_.ObjectACL.md)  } \| `Omit`<[`MetaObject`](internal_.MetaObject.md), ``"_id"`` \| ``"acl"``\> & { `_id?`: `string` ; `acl?`: [`ObjectACL`](internal_.ObjectACL.md)  } \| `Omit`<[`HostObject`](internal_.HostObject.md), ``"_id"`` \| ``"acl"``\> & { `_id?`: \`system.host.${string}\` ; `acl?`: [`ObjectACL`](internal_.ObjectACL.md)  } \| `Omit`<[`AdapterObject`](internal_.AdapterObject.md), ``"_id"`` \| ``"acl"``\> & { `_id?`: \`system.adapter.${string}\` ; `acl?`: [`ObjectACL`](internal_.ObjectACL.md)  } \| `Omit`<[`InstanceObject`](internal_.InstanceObject.md), ``"_id"`` \| ``"acl"``\> & { `_id?`: \`system.adapter.${string}.${number}\` ; `acl?`: [`ObjectACL`](internal_.ObjectACL.md)  } \| `Omit`<[`UserObject`](internal_.UserObject.md), ``"_id"`` \| ``"acl"``\> & { `_id?`: \`system.user.${string}\` ; `acl?`: [`ObjectACL`](internal_.ObjectACL.md)  } \| `Omit`<[`GroupObject`](internal_.GroupObject.md), ``"_id"`` \| ``"acl"``\> & { `_id?`: \`system.group.${string}\` ; `acl?`: [`ObjectACL`](internal_.ObjectACL.md)  } \| `Omit`<[`ScriptObject`](internal_.ScriptObject.md), ``"_id"`` \| ``"acl"``\> & { `_id?`: `string` ; `acl?`: [`ObjectACL`](internal_.ObjectACL.md)  } \| `Omit`<[`ChartObject`](internal_.ChartObject.md), ``"_id"`` \| ``"acl"``\> & { `_id?`: `string` ; `acl?`: [`ObjectACL`](internal_.ObjectACL.md)  } \| `Omit`<[`ScheduleObject`](internal_.ScheduleObject.md), ``"_id"`` \| ``"acl"``\> & { `_id?`: `string` ; `acl?`: [`ObjectACL`](internal_.ObjectACL.md)  } \| `Omit`<[`OtherObject`](internal_.OtherObject.md), ``"_id"`` \| ``"acl"``\> & { `_id?`: `string` ; `acl?`: [`ObjectACL`](internal_.ObjectACL.md)  } \| `Omit`<[`DesignObject`](internal_.DesignObject.md), ``"_id"`` \| ``"acl"``\> & { `_id?`: \`\_design/${string}\` ; `acl?`: [`ObjectACL`](internal_.ObjectACL.md)  }

#### Defined in

[adapter/src/lib/_Types.ts:201](https://github.com/ioBroker/ioBroker.js-controller/blob/ac19e215/packages/adapter/src/lib/_Types.ts#L201)

___

### options

• `Optional` **options**: ``null`` \| `Record`<`string`, `any`\>

#### Defined in

[adapter/src/lib/_Types.ts:200](https://github.com/ioBroker/ioBroker.js-controller/blob/ac19e215/packages/adapter/src/lib/_Types.ts#L200)
