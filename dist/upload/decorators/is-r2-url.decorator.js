"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IsR2Url = IsR2Url;
const class_validator_1 = require("class-validator");
function IsR2Url(validationOptions) {
    return function (object, propertyName) {
        (0, class_validator_1.registerDecorator)({
            name: 'isR2Url',
            target: object.constructor,
            propertyName: propertyName,
            options: validationOptions,
            validator: {
                validate(value, args) {
                    if (!value)
                        return true;
                    if (typeof value !== 'string')
                        return false;
                    const publicUrl = process.env.R2_PUBLIC_URL;
                    if (!publicUrl || publicUrl === 'https://pub-your-id.r2.dev') {
                        try {
                            new URL(value);
                            return true;
                        }
                        catch {
                            return false;
                        }
                    }
                    const cleanPublicUrl = publicUrl.replace(/\/+$/, '');
                    return value.startsWith(cleanPublicUrl);
                },
                defaultMessage(args) {
                    return `${args.property} must be a valid URL hosted on the Cloudflare R2 bucket.`;
                },
            },
        });
    };
}
//# sourceMappingURL=is-r2-url.decorator.js.map