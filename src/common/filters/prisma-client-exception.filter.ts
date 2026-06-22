import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaClientExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = exception.message;
    let error = 'Internal Server Error';

    switch (exception.code) {
      case 'P2002':
        status = HttpStatus.CONFLICT;
        message = `Unique constraint failed on field: ${exception.meta?.target || 'unknown target'}`;
        error = 'Conflict';
        break;
      case 'P2025':
        status = HttpStatus.NOT_FOUND;
        message = (exception.meta?.cause as string) || 'Record not found';
        error = 'Not Found';
        break;
      case 'P2023':
        status = HttpStatus.BAD_REQUEST;
        message =
          (exception.meta?.message as string) ||
          'Inconsistent column data (Malformed ObjectID)';
        error = 'Bad Request';
        break;
      case 'P2003':
        status = HttpStatus.BAD_REQUEST;
        message = `Foreign key constraint failed on field: ${exception.meta?.field_name || 'unknown field'}`;
        error = 'Bad Request';
        break;
      case 'P2014':
        status = HttpStatus.BAD_REQUEST;
        message = `Relation constraint violation: ${exception.meta?.relation_name || 'required relation violated'}`;
        error = 'Bad Request';
        break;
    }

    response.status(status).json({
      statusCode: status,
      message: message.replace(/\n/g, ' ').trim(),
      error,
    });
  }
}
