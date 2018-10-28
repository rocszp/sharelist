const fs = require('fs')
const mime = require('mime')
const http = require('./http')
const request = require('request')

const getRange = (r , total)=>{
  let [, start, end] = r.match(/(\d*)-(\d*)/);
  start = start ? parseInt(start) : 0
  end = end ? parseInt(end) : total - 1

  return [start , end]
}

const sendFile = async(ctx , path , {maxage , immutable} = {maxage:0 , immutable:false})=>{
  let stats
  try {
    stats = fs.statSync(path)
  } catch (err) {
    const notfound = ['ENOENT', 'ENAMETOOLONG', 'ENOTDIR']
    if (notfound.includes(err.code)) {
      throw createError(404, err)
    }
    err.status = 500
    throw err
  }

  let fileSize = stats.size
  let filename = path.split(/[\/\\]/).pop()


  if (!ctx.response.get('Last-Modified')) ctx.set('Last-Modified', stats.mtime.toUTCString())
  if (!ctx.response.get('Cache-Control')) {
    const directives = ['max-age=' + (maxage / 1000 | 0)]
    if (immutable) {
      directives.push('immutable')
    }
    ctx.set('Cache-Control', directives.join(','))
  }
  

  ctx.set('Content-type',mime.getType(filename))
  
  //partial support
  ctx.set('Accept-Ranges', 'bytes')

  let chunksize = fileSize
  let readOpts = {bufferSize:64*1024}
  let range = ctx.get('range')

  if (range){
    let [start , end] = getRange(ctx.header.range , fileSize)
    console.log( 'range',[start , end]  )
    ctx.set('Content-Range', 'bytes ' + `${start}-${end}/${fileSize}`)
    ctx.status = 206

    readOpts.start = start
    readOpts.end = end
    chunksize = end - start + 1
    
  }else{
    ctx.set('Content-Range', 'bytes ' + `0-${fileSize-1}/${fileSize}`)
  }
  ctx.length = chunksize

  ctx.response.set('Content-Disposition',`attachment;filename=${encodeURIComponent(filename)}`)
  ctx.body = fs.createReadStream(path , readOpts)
}

const sendHTTPFile = async (ctx , url , opts) => {

  /*
  let proxy_header_support = enableRange(data.type)

  if( (data.proxy_header || config.data.enabled_proxy_header ) && proxy_header_support){

    try{
      let th = { ...headers , 'Range': 'bytes=0-'}
      let headers = await http.header2(url,{headers:th})
      // console.log(headers)
      if(headers){
        for(let i in headers){
          ctx.response.set(i, headers[i])
        }
      }
    }catch(e){
      console.log(e)
    }
  }
  */
  
  try{
    let th = { ...opts , 'Range': 'bytes=0-'}
    let headers = await http.header2(url,{headers:th})
    // console.log(headers)

    if(headers){
      for(let i in headers){
        // if(allows.includes(i)){
          ctx.set(i, headers[i])
        // }
      }
    }
  }catch(e){
    console.log(e)
  }
  
  ctx.set('Accept-Ranges', 'bytes')
  ctx.set('Content-type',mime.getType(url))


  //ctx.body = ctx.req.pipe(http.stream({url , headers:opts}))

  ctx.body = ctx.req.pipe(request({url , headers:opts}))
}
module.exports = { sendFile , sendHTTPFile }