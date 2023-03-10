import { NextFunction, Request, response, Response } from "express";
import app from './app'

const setCache =  (Request, Response, NextFunction) => {
    const period = 60 * 5
    if(Request.method === "GET"){
        Response.set('Cache-control', `public, max-age=${period}`)
    } else {
        Response.set("Cache-control", `no-store`)
    }

    NextFunction()
}

app.use(setCache)