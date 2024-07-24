export const paginationFunction = ({ page = 1, size = 2 }) => {
  //it default parameters
  // the required params
  if (page < 1) page = 1;
  if (size < 1) size = 2;

  // equations
  const limit = +size;
  const skip = (+page - 1) * limit;

  return { limit, skip };
};

//page from front
//size from backEnd
