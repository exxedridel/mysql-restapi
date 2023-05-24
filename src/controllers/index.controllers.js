export const ping = async (req, res) => {
  res.send(
    `
      <h1 style="color: blue; text-align: center; padding-block: 45vh;">
        Pong
      </h1>
    `
  );
};
