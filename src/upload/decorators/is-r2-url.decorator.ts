import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';

export function IsR2Url(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isR2Url',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          if (!value) return true; // Let @IsOptional handle null/empty checks
          if (typeof value !== 'string') return false;

          const publicUrl = process.env.R2_PUBLIC_URL;
          if (!publicUrl || publicUrl === 'https://pub-your-id.r2.dev') {
            // If the environment public URL is default/empty, fallback to generic URL validation
            try {
              new URL(value);
              return true;
            } catch {
              return false;
            }
          }

          const cleanPublicUrl = publicUrl.replace(/\/+$/, '');
          return value.startsWith(cleanPublicUrl);
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be a valid URL hosted on the Cloudflare R2 bucket.`;
        },
      },
    });
  };
}
