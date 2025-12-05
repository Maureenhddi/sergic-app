import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.url.startsWith(environment.apiUrl)) {
    const authReq = req.clone({
      setHeaders: {
        'api-token': environment.apiToken
      }
    });
    return next(authReq);
  }
  return next(req);
};
