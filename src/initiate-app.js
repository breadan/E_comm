import db_connection from '../DB/connection.js';
import { globalResponse } from './middlewares/global-response.middleware.js';
import { rollbackSavedDocuments } from './middlewares/rollback-saved-documents.middleware.js';
import { rollbackUploadedFiles } from './middlewares/rollback-uploaded-files.middleware.js';

import * as routers from './modules/index.routes.js';

export const initiateApp = (app, express) => {
  const port = process.env.PORT;

  app.use(express.json());

  db_connection();
  app.use('/auth', routers.authRouter);
  app.use('/user', routers.userRouter);
  app.use('/category', routers.categoryRouter);
  app.use('/subCategory', routers.subCategoryRouter);
  app.use('/brand', routers.brandRouter);
  app.use('/product', routers.productRouter);
  app.use('/cart', routers.cartRouter);

  app.use(globalResponse, rollbackUploadedFiles, rollbackSavedDocuments); //catch global error

  app.get('/', (req, res) => res.send('Hello World!'));
  app.listen(port, () => console.log(`Example app listening on port ${port}!`));
};
