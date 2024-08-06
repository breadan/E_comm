// Global response middleware
export const globalResponse = (err, req, res, next) => {
  if (err) {
    // console.log(err);
    res.status(err['cause'] || 500).json({
      message: 'Catch error global',
      error_msg: err.message,
    });
    next(); //if it catch error will go on to next middleware
  }
};
